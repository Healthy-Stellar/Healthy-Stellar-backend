import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { MedicalStaffService } from './medical-staff.service';

@ApiTags('wards')
@Controller('wards')
export class WardShiftsController {
  constructor(private readonly staffService: MedicalStaffService) {}

  /** GET /wards/:id/shifts?week=YYYY-MM-DD */
  @Get(':id/shifts')
  @ApiOperation({ summary: 'Get all shifts for a ward in a given week' })
  @ApiParam({ name: 'id', description: 'Ward ID' })
  @ApiQuery({ name: 'week', required: false, description: 'ISO date of any day in the target week (defaults to current week)' })
  getWardShifts(@Param('id') wardId: string, @Query('week') week?: string) {
    return this.staffService.getWardShifts(wardId, week);
  }
}
