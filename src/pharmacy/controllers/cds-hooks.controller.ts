import { Controller, Get, Post, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IsArray, IsString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DrugInteractionService, InteractionWarning } from '../services/drug-interaction.service';

// ─── CDS Hooks 2.0 request / response shapes ─────────────────────────────────
// Spec: https://cds-hooks.org/specification/current/

class CdsMedicationDto {
  @IsString()
  system: string; // e.g. "http://www.nlm.nih.gov/research/umls/rxnorm"

  @IsString()
  code: string; // RxNorm CUI or local drug UUID

  @IsString()
  @IsOptional()
  display?: string;
}

class CdsHooksRequestDto {
  @IsString()
  hookInstance: string;

  @IsString()
  hook: string; // "medication-prescribe" | "order-select"

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CdsMedicationDto)
  medications: CdsMedicationDto[];
}

interface CdsCard {
  summary: string;
  detail: string;
  indicator: 'info' | 'warning' | 'critical';
  source: { label: string; url?: string };
  suggestions?: { label: string; actions: { type: string; description: string }[] }[];
}

interface CdsHooksResponse {
  cards: CdsCard[];
}

function warningToCard(w: InteractionWarning): CdsCard {
  const indicator: CdsCard['indicator'] =
    w.severity === 'contraindicated' || w.severity === 'major'
      ? 'critical'
      : w.severity === 'moderate'
        ? 'warning'
        : 'info';

  return {
    summary: `${w.severity.toUpperCase()} interaction: ${w.drug1Name} ↔ ${w.drug2Name}${w.via ? ` (via ${w.via})` : ''}`,
    detail: [
      `**Mechanism:** ${w.mechanism}`,
      `**Clinical effects:** ${w.clinicalEffects}`,
      `**Management:** ${w.management}`,
      `**Evidence level:** ${w.evidenceLevel}`,
      `**Source:** ${w.source}`,
    ].join('\n\n'),
    indicator,
    source: {
      label: w.source === 'openfda' ? 'OpenFDA Drug Label' : 'Internal Interaction Database',
      url: w.source === 'openfda' ? 'https://open.fda.gov/apis/drug/label/' : undefined,
    },
    suggestions:
      w.severity === 'contraindicated'
        ? [
            {
              label: 'Remove contraindicated drug',
              actions: [
                {
                  type: 'delete',
                  description: `Remove ${w.drug2Name} from the medication order`,
                },
              ],
            },
          ]
        : undefined,
  };
}

@ApiTags('CDS Hooks')
@Controller('cds-hooks')
export class CdsHooksController {
  constructor(private readonly interactionService: DrugInteractionService) {}

  /**
   * CDS Hooks 2.0 discovery endpoint.
   * EHR systems call GET /cds-hooks to enumerate available services.
   */
  @Get()
  @ApiOperation({ summary: 'CDS Hooks discovery endpoint' })
  @ApiResponse({ status: 200, description: 'Available CDS services' })
  discover() {
    return {
      services: [
        {
          hook: 'medication-prescribe',
          id: 'drug-interaction-check',
          title: 'Drug Interaction Checker',
          description:
            'Checks direct, indirect (BFS depth-2), and OpenFDA-validated drug interactions for the current medication regimen.',
          prefetch: {
            medications: 'MedicationRequest?patient={{context.patientId}}&status=active',
          },
        },
      ],
    };
  }

  /**
   * CDS Hooks 2.0 service endpoint.
   * EHR systems POST here during medication-prescribe / order-select workflows.
   */
  @Post('drug-interaction-check')
  @HttpCode(200)
  @ApiOperation({ summary: 'CDS Hooks drug interaction check (medication-prescribe)' })
  @ApiResponse({ status: 200, description: 'CDS cards with interaction warnings' })
  async check(@Body() body: CdsHooksRequestDto): Promise<CdsHooksResponse> {
    // Extract local drug IDs from the medication coding (code field used as drugId)
    const drugIds = body.medications.map((m) => m.code);

    const result = await this.interactionService.checkInteractions(drugIds);

    const cards = result.warnings.map(warningToCard);

    return { cards };
  }
}
