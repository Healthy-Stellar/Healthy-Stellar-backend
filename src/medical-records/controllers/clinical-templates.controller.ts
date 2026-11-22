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
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { API_BEARER_AUTH_SCHEME } from '../../common/constants/swagger.constants';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/entities/user.entity';
import { authenticatedUserId } from '../../auth/utils/authenticated-user-id';
import { ClinicalTemplatesService } from '../services/clinical-templates.service';
import { CreateClinicalTemplateDto } from '../dto/create-clinical-template.dto';
import { TemplateCategory } from '../entities/clinical-note-template.entity';

const TEMPLATE_READERS = [
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.PHYSICIAN,
  UserRole.SURGEON,
  UserRole.NURSE,
  UserRole.MEDICAL_RECORDS,
];
const TEMPLATE_AUTHORS = [
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.PHYSICIAN,
  UserRole.SURGEON,
  UserRole.MEDICAL_RECORDS,
];
const TEMPLATE_ADMINS = [UserRole.ADMIN, UserRole.SUPER_ADMIN];

@ApiTags('Clinical Templates')
@ApiBearerAuth(API_BEARER_AUTH_SCHEME)
@Controller('clinical-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...TEMPLATE_READERS)
export class ClinicalTemplatesController {
  constructor(private readonly templatesService: ClinicalTemplatesService) {}

  @Post()
  @Roles(...TEMPLATE_AUTHORS)
  @ApiOperation({ summary: 'Create a new clinical note template' })
  @ApiResponse({ status: 201, description: 'Template created successfully' })
  async create(@Body() createDto: CreateClinicalTemplateDto, @Req() req: any) {
    return this.templatesService.create(createDto, authenticatedUserId(req));
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
  @Roles(...TEMPLATE_AUTHORS)
  @ApiOperation({ summary: 'Update a clinical template' })
  @ApiResponse({ status: 200, description: 'Template updated successfully' })
  async update(@Param('id') id: string, @Body() updateDto: Partial<CreateClinicalTemplateDto>) {
    return this.templatesService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles(...TEMPLATE_ADMINS)
  @ApiOperation({ summary: 'Delete a clinical template' })
  @ApiResponse({ status: 200, description: 'Template deleted successfully' })
  async delete(@Param('id') id: string) {
    await this.templatesService.delete(id);
  }
}
