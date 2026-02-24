import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { BedsService } from './beds.service';
import { AssignBedDto } from './dto/assign-bed.dto';

@Controller('beds')
export class BedsController {
  constructor(private readonly bedsService: BedsService) {}

  @Post(':id/assign')
  async assignBed(@Param('id') id: string, @Body() assignBedDto: AssignBedDto) {
    return this.bedsService.assignBed(id, assignBedDto);
  }

  @Patch(':id/release')
  async releaseBed(@Param('id') id: string) {
    return this.bedsService.releaseBed(id);
  }

  @Patch(':id/mark-available')
  async markAvailable(@Param('id') id: string) {
    return this.bedsService.markBedAvailable(id);
  }

  @Get('available')
  async getAvailableBeds(@Query('roomId') roomId?: string) {
    return this.bedsService.getAvailableBeds(roomId);
  }

  @Get('availability/ward/:wardId')
  async getWardAvailability(@Param('wardId') wardId: string) {
    return this.bedsService.getBedAvailabilityByWard(wardId);
  }
}
