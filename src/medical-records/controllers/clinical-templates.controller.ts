import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ClinicalTemplatesService } from '../services/clinical-templates.service';
import { CreateClinicalTemplateDto } from '../dto/create-clinical-template.dto';
import { TemplateCategory } from '../entities/clinical-note-template.entity';

@ApiTags('Clinical Templates')
@Controller('clinical-templates')
export class ClinicalTemplatesController {
  constructor(private readonly templatesService: ClinicalTemplatesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new clinical note template' })
  @ApiResponse({ status: 201, description: 'Template created successfully' })
  async create(@Body() createDto: CreateClinicalTemplateDto, @Req() req: any) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000000';
    return this.templatesService.create(createDto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all active clinical templates' })
  @ApiResponse({ status: 200, description: 'Templates retrieved successfully' })
  async findAll(@Query('category') category?: TemplateCategory) {
    return this.templatesService.findAll(category);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a clinical template by ID' })
  @ApiResponse({ status: 200, description: 'Template retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async findOne(@Param('id') id: string) {
    return this.templatesService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a clinical template' })
  @ApiResponse({ status: 200, description: 'Template updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: Partial<CreateClinicalTemplateDto>,
  ) {
    return this.templatesService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a clinical template' })
  @ApiResponse({ status: 200, description: 'Template deleted successfully' })
  async delete(@Param('id') id: string) {
    await this.templatesService.delete(id);
  }
}
