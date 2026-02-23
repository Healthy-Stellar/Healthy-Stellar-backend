import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TenantService } from '../services/tenant.service';
import { CreateTenantDto, UpdateTenantDto } from '../dto/tenant.dto';

@ApiTags('Tenant Management')
@ApiBearerAuth('medical-auth')
@Controller('admin/tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  @ApiOperation({
    summary: 'Create new tenant',
    description: 'Provisions a new tenant with dedicated PostgreSQL schema, runs migrations, and seeds base data'
  })
  @ApiResponse({ status: 201, description: 'Tenant created and schema provisioned' })
  @ApiResponse({ status: 409, description: 'Tenant with this slug already exists' })
  async create(@Body() createTenantDto: CreateTenantDto) {
    return this.tenantService.create(createTenantDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all tenants' })
  @ApiResponse({ status: 200, description: 'Tenants retrieved' })
  async findAll() {
    return this.tenantService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tenant details' })
  @ApiResponse({ status: 200, description: 'Tenant retrieved' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async findOne(@Param('id') id: string) {
    return this.tenantService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update tenant' })
  @ApiResponse({ status: 200, description: 'Tenant updated' })
  async update(@Param('id') id: string, @Body() updateTenantDto: UpdateTenantDto) {
    return this.tenantService.update(id, updateTenantDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete tenant and schema' })
  @ApiResponse({ status: 200, description: 'Tenant deleted' })
  async delete(@Param('id') id: string) {
    await this.tenantService.delete(id);
    return { message: 'Tenant deleted successfully' };
  }
}
