import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { API_BEARER_AUTH_SCHEME } from '../../common/constants/swagger.constants';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserRole } from '../../auth/entities/user.entity';
import { JwtPayload } from '../../auth/services/auth-token.service';
import { IncidentManagementService } from '../services/incident-management.service';
import {
  AcknowledgeIncidentDto,
  CreateIncidentDto,
  IncidentManagementQueryDto,
  IncidentSlaReportQueryDto,
  ReopenIncidentDto,
  ResolveIncidentManagementDto,
} from '../dto/incident-management.dto';

@ApiTags('incidents')
@ApiBearerAuth(API_BEARER_AUTH_SCHEME)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.COMPLIANCE_OFFICER)
@Controller('incidents')
export class IncidentManagementController {
  constructor(private readonly service: IncidentManagementService) {}

  @Post()
  @ApiOperation({ summary: 'Open a new tracked incident' })
  @ApiResponse({ status: 201, description: 'Incident created' })
  create(@Body() dto: CreateIncidentDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List incidents' })
  list(@Query() query: IncidentManagementQueryDto) {
    return this.service.list(query);
  }

  @Get('sla-report')
  @ApiOperation({ summary: 'SLA compliance report for a time window' })
  slaReport(@Query() query: IncidentSlaReportQueryDto) {
    return this.service.getSlaReport(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single incident' })
  findOne(@Param('id') id: string) {
    return this.service.findOneOrFail(id);
  }

  @Patch(':id/acknowledge')
  @ApiOperation({ summary: 'Acknowledge an incident (sets firstResponseAt)' })
  @ApiResponse({ status: 409, description: 'Invalid state transition' })
  acknowledge(
    @Param('id') id: string,
    @Body() dto: AcknowledgeIncidentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.acknowledge(id, dto, user.userId);
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Resolve an incident' })
  @ApiResponse({ status: 409, description: 'Invalid state transition' })
  resolve(
    @Param('id') id: string,
    @Body() dto: ResolveIncidentManagementDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.resolve(id, dto, user.userId);
  }

  @Patch(':id/reopen')
  @ApiOperation({ summary: 'Reopen a resolved incident (RESOLVED → OPEN)' })
  @ApiResponse({ status: 409, description: 'Invalid state transition' })
  reopen(
    @Param('id') id: string,
    @Body() dto: ReopenIncidentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.reopen(id, dto, user.userId);
  }
}
