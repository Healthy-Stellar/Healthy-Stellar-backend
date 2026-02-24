import { Controller, Get, Post, Body, Param, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LabEquipmentService } from '../services/lab-equipment.service';
import { CreateLabEquipmentDto } from '../dto/create-lab-equipment.dto';
import { EquipmentStatus } from '../entities/lab-equipment.entity';

@ApiTags('Lab Equipment')
@Controller('lab-equipment')
export class LabEquipmentController {
  constructor(private readonly equipmentService: LabEquipmentService) {}

  @Post()
  @ApiOperation({ summary: 'Register new lab equipment' })
  @ApiResponse({ status: 201, description: 'Equipment registered successfully' })
  create(@Body() createEquipmentDto: CreateLabEquipmentDto) {
    return this.equipmentService.create(createEquipmentDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all lab equipment' })
  @ApiResponse({ status: 200, description: 'List of all equipment' })
  findAll() {
    return this.equipmentService.findAll();
  }

  @Get('status/:status')
  @ApiOperation({ summary: 'Get equipment by status' })
  @ApiResponse({ status: 200, description: 'List of equipment with specified status' })
  findByStatus(@Param('status') status: EquipmentStatus) {
    return this.equipmentService.getEquipmentByStatus(status);
  }

  @Get('maintenance/due')
  @ApiOperation({ summary: 'Get equipment due for maintenance' })
  @ApiResponse({ status: 200, description: 'List of equipment due for maintenance or calibration' })
  getDueMaintenance() {
    return this.equipmentService.getEquipmentDueMaintenance();
  }

  @Get('interfaces/status')
  @ApiOperation({ summary: 'Get interface status for all equipment' })
  @ApiResponse({ status: 200, description: 'List of equipment interfaces and their status' })
  getInterfaceStatus() {
    return this.equipmentService.getInterfaceStatus();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get equipment by ID' })
  @ApiResponse({ status: 200, description: 'Equipment details' })
  findOne(@Param('id') id: string) {
    return this.equipmentService.findOne(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update equipment status' })
  @ApiResponse({ status: 200, description: 'Equipment status updated successfully' })
  updateStatus(@Param('id') id: string, @Body('status') status: EquipmentStatus) {
    return this.equipmentService.updateStatus(id, status);
  }

  @Patch(':id/schedule-maintenance')
  @ApiOperation({ summary: 'Schedule maintenance and calibration' })
  @ApiResponse({ status: 200, description: 'Maintenance scheduled successfully' })
  scheduleMaintenance(
    @Param('id') id: string,
    @Body('maintenanceDate') maintenanceDate?: string,
    @Body('calibrationDate') calibrationDate?: string,
  ) {
    return this.equipmentService.scheduleMaintenanceCalibration(
      id,
      maintenanceDate ? new Date(maintenanceDate) : undefined,
      calibrationDate ? new Date(calibrationDate) : undefined,
    );
  }

  @Post('interfaces/:interfaceId/test')
  @ApiOperation({ summary: 'Test equipment interface connection' })
  @ApiResponse({ status: 200, description: 'Interface test results' })
  testInterface(@Param('interfaceId') interfaceId: string) {
    return this.equipmentService.testInterface(interfaceId);
  }
}
