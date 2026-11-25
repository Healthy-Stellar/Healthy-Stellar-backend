import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { API_BEARER_AUTH_SCHEME } from '../common/constants/swagger.constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { JwtPayload } from '../auth/services/auth-token.service';
import { BedOccupancyService } from './bed-occupancy.service';
import {
  AssignBedDto,
  BedOccupancyQueryDto,
  CreateBedDto,
  CreateRoomDto,
  CreateWardDto,
  UpdateBedStatusDto,
} from './dto/bed-occupancy.dto';

/** Roles allowed to provision wards, rooms, and beds. */
export const BED_ADMIN_ROLES = [UserRole.ADMIN, UserRole.SUPER_ADMIN];

/** Roles allowed to assign, release, or update operational bed status. */
export const BED_MANAGEMENT_ROLES = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.NURSE];

/** Clinical/staff/admin roles allowed to view ward, room, bed, and occupancy data. */
export const BED_READ_ROLES = [
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.NURSE,
  UserRole.PHYSICIAN,
  UserRole.SURGEON,
  UserRole.MEDICAL_RECORDS,
];

/** Extracts the authoritative tenant identifier from the authenticated JWT principal. */
function getTenantId(req: Request): string {
  const user = (req as Request & { user?: JwtPayload & { tenantId?: string } }).user;
  const tenantId = user?.organizationId ?? user?.tenantId;
  if (!tenantId || typeof tenantId !== 'string') {
    throw new ForbiddenException('Tenant context is required');
  }
  return tenantId;
}

@ApiTags('bed-occupancy')
@ApiBearerAuth(API_BEARER_AUTH_SCHEME)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...BED_READ_ROLES)
@Controller('bed-occupancy')
export class BedOccupancyController {
  constructor(private readonly service: BedOccupancyService) {}

  // ── Wards ─────────────────────────────────────────────────────────────────

  @Post('wards')
  @Roles(...BED_ADMIN_ROLES)
  createWard(@Body() dto: CreateWardDto, @Req() req: Request) {
    return this.service.createWard(dto, getTenantId(req));
  }

  @Get('wards')
  @Roles(...BED_READ_ROLES)
  getWards(@Req() req: Request) {
    return this.service.getWards(getTenantId(req));
  }

  // ── Rooms ─────────────────────────────────────────────────────────────────

  @Post('rooms')
  @Roles(...BED_ADMIN_ROLES)
  createRoom(@Body() dto: CreateRoomDto, @Req() req: Request) {
    return this.service.createRoom(dto, getTenantId(req));
  }

  @Get('wards/:wardId/rooms')
  @Roles(...BED_READ_ROLES)
  getRoomsByWard(@Param('wardId') wardId: string, @Req() req: Request) {
    return this.service.getRoomsByWard(wardId, getTenantId(req));
  }

  // ── Beds ──────────────────────────────────────────────────────────────────

  @Post('beds')
  @Roles(...BED_ADMIN_ROLES)
  createBed(@Body() dto: CreateBedDto, @Req() req: Request) {
    return this.service.createBed(dto, getTenantId(req));
  }

  @Get('beds')
  @Roles(...BED_READ_ROLES)
  getBeds(@Query() query: BedOccupancyQueryDto, @Req() req: Request) {
    return this.service.getBeds(query, getTenantId(req));
  }

  @Get('beds/:id')
  @Roles(...BED_READ_ROLES)
  getBedById(@Param('id') id: string, @Req() req: Request) {
    return this.service.getBedById(id, getTenantId(req));
  }

  @Post('beds/assign')
  @Roles(...BED_MANAGEMENT_ROLES)
  assignBed(@Body() dto: AssignBedDto, @Req() req: Request) {
    return this.service.assignBed(dto, getTenantId(req));
  }

  @Patch('beds/:id/release')
  @Roles(...BED_MANAGEMENT_ROLES)
  releaseBed(@Param('id') id: string, @Req() req: Request) {
    return this.service.releaseBed(id, getTenantId(req));
  }

  @Patch('beds/:id/status')
  @Roles(...BED_MANAGEMENT_ROLES)
  updateBedStatus(
    @Param('id') id: string,
    @Body() dto: UpdateBedStatusDto,
    @Req() req: Request,
  ) {
    return this.service.updateBedStatus(id, dto, getTenantId(req));
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  @Get('summary')
  @Roles(...BED_READ_ROLES)
  getOccupancySummary(@Req() req: Request, @Query('wardId') wardId?: string) {
    return this.service.getOccupancySummary(getTenantId(req), wardId);
  }
}
