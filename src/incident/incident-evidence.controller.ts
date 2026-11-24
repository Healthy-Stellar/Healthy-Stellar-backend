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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { API_BEARER_AUTH_SCHEME } from '../common/constants/swagger.constants';
import { IncidentEvidenceService } from './incident-evidence.service';
import {
  CaptureIncidentDto,
  IncidentQueryDto,
  ResolveIncidentDto,
  UpdateIncidentNotesDto,
} from './dto/incident.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { JwtPayload } from '../auth/services/auth-token.service';

@ApiTags('incident-evidence')
@ApiBearerAuth(API_BEARER_AUTH_SCHEME)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.COMPLIANCE_OFFICER)
@Controller('incidents/evidence')
export class IncidentEvidenceController {
  constructor(private readonly service: IncidentEvidenceService) {}

  @Post()
  @ApiOperation({ summary: 'Capture a structured incident evidence bundle' })
  @ApiResponse({ status: 201, description: 'Evidence bundle persisted' })
  capture(@Body() dto: CaptureIncidentDto, @CurrentUser() user: JwtPayload) {
    return this.service.capture({ ...dto, triggeredBy: user.userId });
  }

  @Get()
  @ApiOperation({ summary: 'List incident evidence bundles' })
  list(@Query() query: IncidentQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single incident evidence bundle' })
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Mark an incident evidence bundle as resolved' })
  resolve(
    @Param('id') id: string,
    @Body() dto: ResolveIncidentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.resolve(id, dto, user.userId);
  }

  @Patch(':id/notes')
  @ApiOperation({ summary: 'Append investigation notes to an incident' })
  addNotes(@Param('id') id: string, @Body() dto: UpdateIncidentNotesDto) {
    return this.service.addNotes(id, dto);
  }
}
