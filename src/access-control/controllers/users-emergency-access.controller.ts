import { Body, Controller, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { UserRole } from '../../auth/entities/user.entity';
import { UpdateEmergencyAccessDto } from '../../auth/dto/update-emergency-access.dto';
import { AccessControlService } from '../services/access-control.service';

@ApiTags('Users')
@Controller('users')
export class UsersEmergencyAccessController {
  constructor(private readonly accessControlService: AccessControlService) {}

  @Patch(':id/emergency-access')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin enables/disables emergency access for a user' })
  @ApiResponse({ status: 200, description: 'Emergency access setting updated' })
  async setEmergencyAccess(
    @Param('id') id: string,
    @Body() dto: UpdateEmergencyAccessDto,
    @Req() req: any,
  ) {
    const actorUserId = req.user?.userId || req.user?.id;
    return this.accessControlService.setEmergencyAccessEnabled(id, dto.enabled, actorUserId);
  }
}
