import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { PathologyCase } from './entities/pathology-case.entity';
import { PathologySpecimen } from './entities/pathology-specimen.entity';
import { HistologySlide } from './entities/histology-slide.entity';
import { CytologySlide } from './entities/cytology-slide.entity';
import { DigitalImage } from './entities/digital-image.entity';
import { PathologyReport } from './entities/pathology-report.entity';
import { ReportTemplate } from './entities/report-template.entity';
import { MolecularTest } from './entities/molecular-test.entity';
import { GeneticTest } from './entities/genetic-test.entity';
import { QualityControlLog } from './entities/quality-control.entity';

// Services
import { PathologyCaseService } from './services/pathology-case.service';
import { SpecimenProcessingService } from './services/specimen-processing.service';
import { HistologyService } from './services/histology.service';
import { CytologyService } from './services/cytology.service';
import { DigitalPathologyService } from './services/digital-pathology.service';
import { PathologyReportService } from './services/pathology-report.service';
import { ReportTemplateService } from './services/report-template.service';
import { MolecularDiagnosticsService } from './services/molecular-diagnostics.service';
import { GeneticTestingService } from './services/genetic-testing.service';
import { PathologyQualityService } from './services/pathology-quality.service';

// Controllers
import { PathologyCaseController } from './controllers/pathology-case.controller';
import { SpecimenController } from './controllers/specimen.controller';
import { HistologyController } from './controllers/histology.controller';
import { CytologyController } from './controllers/cytology.controller';
import { DigitalPathologyController } from './controllers/digital-pathology.controller';
import { PathologyReportController } from './controllers/pathology-report.controller';
import { MolecularDiagnosticsController } from './controllers/molecular-diagnostics.controller';
import { GeneticTestingController } from './controllers/genetic-testing.controller';
import { QualityControlController } from './controllers/quality-control.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PathologyCase,
      PathologySpecimen,
      HistologySlide,
      CytologySlide,
      DigitalImage,
      PathologyReport,
      ReportTemplate,
      MolecularTest,
      GeneticTest,
      QualityControlLog,
    ]),
  ],
  controllers: [
    PathologyCaseController,
    SpecimenController,
    HistologyController,
    CytologyController,
    DigitalPathologyController,
    PathologyReportController,
    MolecularDiagnosticsController,
    GeneticTestingController,
    QualityControlController,
  ],
  providers: [
    PathologyCaseService,
    SpecimenProcessingService,
    HistologyService,
    CytologyService,
    DigitalPathologyService,
    PathologyReportService,
    ReportTemplateService,
    MolecularDiagnosticsService,
    GeneticTestingService,
    PathologyQualityService,
  ],
  exports: [
    PathologyCaseService,
    SpecimenProcessingService,
    HistologyService,
    CytologyService,
    DigitalPathologyService,
    PathologyReportService,
    ReportTemplateService,
    MolecularDiagnosticsService,
    GeneticTestingService,
    PathologyQualityService,
  ],
})
export class PathologyModule {}
