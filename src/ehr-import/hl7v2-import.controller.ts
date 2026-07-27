import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Hl7v2LabImportService } from './services/hl7v2-lab-import.service';
import { ImportHl7v2Dto } from './dto/import-hl7v2.dto';

@ApiTags('EHR Import')
@Controller('ehr-import')
export class Hl7v2ImportController {
  constructor(private readonly hl7v2LabImportService: Hl7v2LabImportService) {}

  @Post('hl7v2')
  @ApiOperation({
    summary: 'Import lab results from a raw HL7 v2 ORU^R01 message',
    description:
      'Accepts a raw, pipe-delimited HL7 v2 ORU^R01 message (segments separated by CR/LF), ' +
      'validates MSH/PID/OBR/OBX segments, maps OBX-3 LOINC codes to internal test codes, ' +
      'and persists the results as LabResult rows.',
  })
  @ApiBody({ type: ImportHl7v2Dto })
  async importHl7v2(@Body() dto: ImportHl7v2Dto) {
    const { created } = await this.hl7v2LabImportService.importRaw(dto.message);
    return {
      imported: created.length,
      results: created.map((r) => ({ id: r.id, orderId: r.orderId, testCode: r.testCode })),
    };
  }
}
