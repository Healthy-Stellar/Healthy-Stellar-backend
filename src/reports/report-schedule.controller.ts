import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ReportScheduleService } from './report-schedule.service';
import { CreateReportScheduleDto, UpdateReportScheduleDto } from './dto/report-schedule.dto';

@ApiTags('Admin - Report Schedules')
@Controller('admin/report-schedules')
export class ReportScheduleController {
  constructor(private readonly scheduleService: ReportScheduleService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new report delivery schedule' })
  create(@Body() dto: CreateReportScheduleDto) {
    return this.scheduleService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all report schedules' })
  findAll() {
    return this.scheduleService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single report schedule' })
  findOne(@Param('id') id: string) {
    return this.scheduleService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a report schedule' })
  update(@Param('id') id: string, @Body() dto: UpdateReportScheduleDto) {
    return this.scheduleService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a report schedule' })
  remove(@Param('id') id: string) {
    return this.scheduleService.remove(id);
  }

  /** One-click unsubscribe link handler embedded in every delivery email. */
  @Get('unsubscribe')
  @ApiOperation({ summary: 'Unsubscribe a recipient from a report schedule' })
  unsubscribe(@Query('token') token: string, @Query('email') email: string) {
    return this.scheduleService.unsubscribe(token, email);
  }
}
