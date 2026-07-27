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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BedOccupancyService } from './bed-occupancy.service';
import {
  AssignBedDto,
  BedOccupancyQueryDto,
  CreateBedDto,
  CreateRoomDto,
  CreateWardDto,
  UpdateBedStatusDto,
} from './dto/bed-occupancy.dto';

@UseGuards(JwtAuthGuard)
@Controller('bed-occupancy')
export class BedOccupancyController {
  constructor(private readonly service: BedOccupancyService) {}

  // ── Wards ─────────────────────────────────────────────────────────────────

  @Post('wards')
  createWard(@Body() dto: CreateWardDto) {
    return this.service.createWard(dto);
  }

  @Get('wards')
  getWards() {
    return this.service.getWards();
  }

  // ── Rooms ─────────────────────────────────────────────────────────────────

  @Post('rooms')
  createRoom(@Body() dto: CreateRoomDto) {
    return this.service.createRoom(dto);
  }

  @Get('wards/:wardId/rooms')
  getRoomsByWard(@Param('wardId') wardId: string) {
    return this.service.getRoomsByWard(wardId);
  }

  // ── Beds ──────────────────────────────────────────────────────────────────

  @Post('beds')
  createBed(@Body() dto: CreateBedDto) {
    return this.service.createBed(dto);
  }

  @Get('beds')
  getBeds(@Query() query: BedOccupancyQueryDto) {
    return this.service.getBeds(query);
  }

  @Get('beds/:id')
  getBedById(@Param('id') id: string) {
    return this.service.getBedById(id);
  }

  @Post('beds/assign')
  assignBed(@Body() dto: AssignBedDto) {
    return this.service.assignBed(dto);
  }

  @Patch('beds/:id/release')
  releaseBed(@Param('id') id: string) {
    return this.service.releaseBed(id);
  }

  @Patch('beds/:id/status')
  updateBedStatus(@Param('id') id: string, @Body() dto: UpdateBedStatusDto) {
    return this.service.updateBedStatus(id, dto);
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  @Get('summary')
  getOccupancySummary(@Query('wardId') wardId?: string) {
    return this.service.getOccupancySummary(wardId);
  }
}
