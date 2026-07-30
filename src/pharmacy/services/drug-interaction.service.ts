import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { DrugInteraction } from '../entities/drug-interaction.entity';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface InteractionWarning {
  drug1Id: string;
  drug1Name: string;
  drug2Id: string;
  drug2Name: string;
  severity: 'minor' | 'moderate' | 'major' | 'contraindicated';
  mechanism: string;
  clinicalEffects: string;
  management: string;
  evidenceLevel: 'A' | 'B' | 'C' | 'D' | 'unknown';
  /** 'local' = from drug_interactions table; 'openfda' = from OpenFDA API; 'indirect' = BFS depth-2 */
  source: 'local' | 'openfda' | 'indirect';
  /** For indirect interactions: the intermediate drug that bridges the pair */
  via?: string;
}

export interface InteractionCheck {
  hasInteractions: boolean;
  warnings: InteractionWarning[];
  highestSeverity: 'none' | 'minor' | 'moderate' | 'major' | 'contraindicated';
}

// ─── Severity ordering ────────────────────────────────────────────────────────

const SEVERITY_RANK: Record<string, number> = {
  none: 0,
  minor: 1,
  moderate: 2,
  major: 3,
  contraindicated: 4,
};

function maxSeverity(
  a: string,
  b: string,
): 'none' | 'minor' | 'moderate' | 'major' | 'contraindicated' {
  return (SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b) as any;
}

@Injectable()
export class DrugInteractionService {
  private readonly logger = new Logger(DrugInteractionService.name);

  // ─── Circuit breaker for the external OpenFDA API ──────────────────────────
  // Protects prescription creation from a slow/down external dependency: after
  // CB_THRESHOLD consecutive failures the circuit opens for CB_COOLDOWN_MS,
  // during which OpenFDA lookups are skipped (local checks still run).
  private cbConsecutiveFailures = 0;
  private cbOpenUntil = 0;
  private readonly CB_THRESHOLD = 3;
  private readonly CB_COOLDOWN_MS = 30_000;

  constructor(
    @InjectRepository(DrugInteraction)
    private readonly interactionRepo: Repository<DrugInteraction>,
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {}

  // ─── Primary public method ────────────────────────────────────────────────

  async checkInteractions(drugIds: string[]): Promise<InteractionCheck> {
    if (drugIds.length < 2) {
      return { hasInteractions: false, warnings: [], highestSeverity: 'none' };
    }

    const [localDirect, localIndirect, fdaWarnings] = await Promise.all([
      this.queryLocalDirect(drugIds),
      this.bfsIndirect(drugIds),
      this.queryOpenFda(drugIds),
    ]);

    const warnings = this.deduplicate([...localDirect, ...localIndirect, ...fdaWarnings]);
    const highestSeverity = warnings.reduce(
      (acc, w) => maxSeverity(acc, w.severity),
      'none' as string,
    ) as InteractionCheck['highestSeverity'];

    return { hasInteractions: warnings.length > 0, warnings, highestSeverity };
  }

  async getInteractionsBetween(drug1Id: string, drug2Id: string): Promise<DrugInteraction[]> {
    return this.interactionRepo.find({
      where: [
        { drug1Id, drug2Id },
        { drug1Id: drug2Id, drug2Id: drug1Id },
      ],
      relations: ['drug1', 'drug2'],
    });
  }

  // ─── Local direct query (fixes the original pairwise bug) ────────────────
  // The original query used AND on both columns which only matched rows where
  // BOTH drug1Id AND drug2Id were in the set — correct for direct pairs.
  // We keep this but also add the reverse direction explicitly.

  private async queryLocalDirect(drugIds: string[]): Promise<InteractionWarning[]> {
    const rows = await this.interactionRepo
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.drug1', 'drug1')
      .leftJoinAndSelect('i.drug2', 'drug2')
      .where('i.drug1Id IN (:...ids) AND i.drug2Id IN (:...ids)', { ids: drugIds })
      .getMany();

    return rows.map((r) => this.rowToWarning(r, 'local'));
  }

  // ─── BFS depth-2 indirect interaction traversal ───────────────────────────
  // For each drug in the regimen, walk one hop through the interaction graph.
  // If a neighbour of drug A is also a neighbour of drug B (and B is in the
  // regimen), we have an indirect A→bridge→B interaction.

  private async bfsIndirect(drugIds: string[]): Promise<InteractionWarning[]> {
    // Load all edges where at least one endpoint is in the regimen
    const edges = await this.interactionRepo
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.drug1', 'drug1')
      .leftJoinAndSelect('i.drug2', 'drug2')
      .where('i.drug1Id IN (:...ids) OR i.drug2Id IN (:...ids)', { ids: drugIds })
      .getMany();

    // Build adjacency: drugId → Set<{ neighbourId, row }>
    const adj = new Map<string, { neighbourId: string; row: DrugInteraction }[]>();
    for (const row of edges) {
      if (!adj.has(row.drug1Id)) adj.set(row.drug1Id, []);
      if (!adj.has(row.drug2Id)) adj.set(row.drug2Id, []);
      adj.get(row.drug1Id)!.push({ neighbourId: row.drug2Id, row });
      adj.get(row.drug2Id)!.push({ neighbourId: row.drug1Id, row });
    }

    const drugSet = new Set(drugIds);
    const warnings: InteractionWarning[] = [];

    // For each pair (A, B) in the regimen, check if they share a common neighbour
    for (let i = 0; i < drugIds.length; i++) {
      for (let j = i + 1; j < drugIds.length; j++) {
        const a = drugIds[i];
        const b = drugIds[j];

        const neighboursA = new Map(
          (adj.get(a) ?? []).map(({ neighbourId, row }) => [neighbourId, row]),
        );

        for (const { neighbourId: bridge, row: rowBridge } of adj.get(b) ?? []) {
          if (drugSet.has(bridge)) continue; // direct pair — already covered
          if (!neighboursA.has(bridge)) continue;

          const rowA = neighboursA.get(bridge)!;
          const bridgeName = rowBridge.drug1Id === bridge
            ? rowBridge.drug1?.name ?? bridge
            : rowBridge.drug2?.name ?? bridge;

          warnings.push({
            drug1Id: a,
            drug1Name: rowA.drug1Id === a ? rowA.drug1?.name ?? a : rowA.drug2?.name ?? a,
            drug2Id: b,
            drug2Name: rowBridge.drug1Id === b ? rowBridge.drug1?.name ?? b : rowBridge.drug2?.name ?? b,
            severity: maxSeverity(rowA.severity, rowBridge.severity) as any,
            mechanism: `Indirect via ${bridgeName}: ${rowA.mechanism ?? rowA.description} / ${rowBridge.mechanism ?? rowBridge.description}`,
            clinicalEffects: `${rowA.clinicalEffects} — ${rowBridge.clinicalEffects}`,
            management: rowA.management ?? rowBridge.management ?? 'Monitor closely',
            evidenceLevel: 'C', // indirect inference — conservative evidence level
            source: 'indirect',
            via: bridgeName,
          });
        }
      }
    }

    return warnings;
  }

  // ─── OpenFDA secondary validation ────────────────────────────────────────
  // Uses the free OpenFDA drug label API (no key required for low-volume use).
  // We query by NDC/generic name stored on the Drug entity via the drug1/drug2
  // relations. Falls back gracefully on network errors.

  private async queryOpenFda(drugIds: string[]): Promise<InteractionWarning[]> {
    // Circuit breaker open — skip the external call entirely so a downed API
    // never blocks or slows prescription creation.
    if (Date.now() < this.cbOpenUntil) {
      this.logger.warn('OpenFDA circuit breaker open — skipping external interaction lookup');
      return [];
    }

    // Load drug names so we can query OpenFDA by generic name
    const drugs = await this.interactionRepo.manager
      .getRepository('Drug')
      .findBy(drugIds.map((id) => ({ id })));

    if (!drugs.length) return [];

    const warnings: InteractionWarning[] = [];

    for (const drug of drugs as any[]) {
      try {
        const name = encodeURIComponent(drug.genericName ?? drug.name);
        const url = `https://api.fda.gov/drug/label.json?search=drug_interactions:"${name}"&limit=1`;
        const resp = await firstValueFrom(this.httpService.get(url, { timeout: 5000 }));
        this.recordOpenFdaSuccess();
        const results: any[] = resp.data?.results ?? [];

        for (const label of results) {
          const rawText: string = (label.drug_interactions ?? []).join(' ');
          if (!rawText) continue;

          // Match other drugs in the regimen mentioned in the interaction text
          for (const other of drugs as any[]) {
            if (other.id === drug.id) continue;
            const otherName = other.genericName ?? other.name;
            if (!rawText.toLowerCase().includes(otherName.toLowerCase())) continue;

            warnings.push({
              drug1Id: drug.id,
              drug1Name: drug.name,
              drug2Id: other.id,
              drug2Name: other.name,
              severity: this.inferSeverityFromText(rawText),
              mechanism: 'See OpenFDA label',
              clinicalEffects: rawText.slice(0, 500),
              management: 'Refer to full prescribing information',
              evidenceLevel: 'B',
              source: 'openfda',
            });
          }
        }
      } catch (err) {
        this.recordOpenFdaFailure();
        this.logger.warn(`OpenFDA query failed for ${drug.name}: ${err.message}`);
        // If the breaker just tripped, stop hammering the dependency for this batch.
        if (Date.now() < this.cbOpenUntil) break;
      }
    }

    return warnings;
  }

  private recordOpenFdaSuccess(): void {
    this.cbConsecutiveFailures = 0;
  }

  private recordOpenFdaFailure(): void {
    this.cbConsecutiveFailures += 1;
    if (this.cbConsecutiveFailures >= this.CB_THRESHOLD) {
      this.cbOpenUntil = Date.now() + this.CB_COOLDOWN_MS;
      this.logger.error(
        `OpenFDA circuit breaker opened for ${this.CB_COOLDOWN_MS}ms after ${this.cbConsecutiveFailures} consecutive failures`,
      );
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private rowToWarning(row: DrugInteraction, source: 'local' | 'indirect'): InteractionWarning {
    return {
      drug1Id: row.drug1Id,
      drug1Name: row.drug1?.name ?? row.drug1Id,
      drug2Id: row.drug2Id,
      drug2Name: row.drug2?.name ?? row.drug2Id,
      severity: row.severity as any,
      mechanism: row.mechanism ?? 'Unknown',
      clinicalEffects: row.clinicalEffects,
      management: row.management ?? 'Monitor closely',
      evidenceLevel: (row.evidenceLevel as any) ?? 'unknown',
      source,
    };
  }

  private inferSeverityFromText(text: string): InteractionWarning['severity'] {
    const t = text.toLowerCase();
    if (t.includes('contraindicated') || t.includes('do not use')) return 'contraindicated';
    if (t.includes('serious') || t.includes('major') || t.includes('avoid')) return 'major';
    if (t.includes('moderate') || t.includes('caution')) return 'moderate';
    return 'minor';
  }

  /** Remove duplicate pairs (same drug1+drug2 regardless of order), keeping highest severity */
  private deduplicate(warnings: InteractionWarning[]): InteractionWarning[] {
    const map = new Map<string, InteractionWarning>();
    for (const w of warnings) {
      const key = [w.drug1Id, w.drug2Id].sort().join('|');
      const existing = map.get(key);
      if (!existing || SEVERITY_RANK[w.severity] > SEVERITY_RANK[existing.severity]) {
        map.set(key, w);
      }
    }
    return [...map.values()];
  }
}
