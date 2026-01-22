import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { MedicalCodeService } from '../services/medical-code.service';
import {
  CreateMedicalCodeDto,
  UpdateMedicalCodeDto,
  SearchMedicalCodeDto,
} from '../dto/medical-code.dto';
import { CodeType } from '../../common/enums';

@ApiTags('medical-codes')
@Controller('medical-codes')
export class MedicalCodeController {
  constructor(private readonly medicalCodeService: MedicalCodeService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new medical code' })
  @ApiResponse({ status: 201, description: 'Medical code created successfully' })
  async create(@Body() createDto: CreateMedicalCodeDto) {
    return this.medicalCodeService.create(createDto);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Bulk create medical codes' })
  @ApiResponse({ status: 201, description: 'Medical codes created successfully' })
  async bulkCreate(@Body() codes: CreateMedicalCodeDto[]) {
    return this.medicalCodeService.bulkCreate(codes);
  }

  @Get()
  @ApiOperation({ summary: 'Search medical codes' })
  @ApiResponse({ status: 200, description: 'Medical codes retrieved successfully' })
  async search(@Query() searchDto: SearchMedicalCodeDto) {
    return this.medicalCodeService.search(searchDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get medical code by ID' })
  @ApiParam({ name: 'id', description: 'Medical code ID' })
  @ApiResponse({ status: 200, description: 'Medical code retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Medical code not found' })
  async findById(@Param('id') id: string) {
    return this.medicalCodeService.findById(id);
  }

  @Get('lookup/:codeType/:code')
  @ApiOperation({ summary: 'Lookup medical code by code and type' })
  @ApiParam({ name: 'codeType', description: 'Code type (CPT, ICD10-CM, etc.)' })
  @ApiParam({ name: 'code', description: 'Medical code value' })
  @ApiResponse({ status: 200, description: 'Medical code retrieved successfully' })
  async findByCode(
    @Param('codeType') codeType: CodeType,
    @Param('code') code: string,
  ) {
    return this.medicalCodeService.findByCode(code, codeType);
  }

  @Get('category/:codeType/:category')
  @ApiOperation({ summary: 'Get codes by category' })
  @ApiParam({ name: 'codeType', description: 'Code type' })
  @ApiParam({ name: 'category', description: 'Category name' })
  async getByCategory(
    @Param('codeType') codeType: CodeType,
    @Param('category') category: string,
  ) {
    if (codeType === CodeType.CPT) {
      return this.medicalCodeService.getCPTCodesByCategory(category);
    }
    return this.medicalCodeService.getICD10CodesByCategory(category);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update medical code' })
  @ApiParam({ name: 'id', description: 'Medical code ID' })
  @ApiResponse({ status: 200, description: 'Medical code updated successfully' })
  @ApiResponse({ status: 404, description: 'Medical code not found' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateMedicalCodeDto) {
    return this.medicalCodeService.update(id, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete medical code' })
  @ApiParam({ name: 'id', description: 'Medical code ID' })
  @ApiResponse({ status: 204, description: 'Medical code deleted successfully' })
  @ApiResponse({ status: 404, description: 'Medical code not found' })
  async delete(@Param('id') id: string) {
    return this.medicalCodeService.delete(id);
  }

  @Put(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate medical code' })
  @ApiParam({ name: 'id', description: 'Medical code ID' })
  @ApiResponse({ status: 200, description: 'Medical code deactivated successfully' })
  async deactivate(@Param('id') id: string) {
    return this.medicalCodeService.deactivate(id);
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate a list of medical codes' })
  @ApiResponse({ status: 200, description: 'Validation result returned' })
  async validateCodes(
    @Body() codes: Array<{ code: string; codeType: CodeType }>,
  ) {
    return this.medicalCodeService.validateCodes(codes);
  }
}
