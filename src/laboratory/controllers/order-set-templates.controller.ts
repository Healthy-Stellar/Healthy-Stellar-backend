import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { API_BEARER_AUTH_SCHEME } from '../../common/constants/swagger.constants';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/entities/user.entity';
import { authenticatedUserId } from '../../auth/utils/authenticated-user-id';
import { OrderSetTemplatesService } from '../services/order-set-templates.service';
import {
  CreateOrderSetTemplateDto,
  UpdateOrderSetTemplateDto,
} from '../dto/create-order-set-template.dto';
import { OrderFromTemplateDto } from '../dto/order-from-template.dto';

const TEMPLATE_READERS = [
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.PHYSICIAN,
  UserRole.SURGEON,
  UserRole.NURSE,
];
const TEMPLATE_ADMINS = [UserRole.ADMIN, UserRole.SUPER_ADMIN];
const LAB_ORDERERS = [UserRole.PHYSICIAN, UserRole.SURGEON];

@ApiTags('order-set-templates')
@ApiBearerAuth(API_BEARER_AUTH_SCHEME)
@Controller('laboratory/order-set-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...TEMPLATE_READERS)
export class OrderSetTemplatesController {
  constructor(private readonly service: OrderSetTemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'List all active order-set templates' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'departmentId', required: false })
  @ApiQuery({ name: 'includeSystem', required: false, type: Boolean })
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('includeSystem') includeSystem?: string,
  ) {
    return this.service.findAll({
      tenantId,
      departmentId,
      includeSystem: includeSystem !== 'false',
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single order-set template' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(...TEMPLATE_ADMINS)
  @ApiOperation({ summary: 'Admin: create a custom order-set template' })
  create(@Body() dto: CreateOrderSetTemplateDto, @Req() req: any) {
    return this.service.create(dto, authenticatedUserId(req));
  }

  @Patch(':id')
  @Roles(...TEMPLATE_ADMINS)
  @ApiOperation({ summary: 'Admin: update a custom order-set template' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderSetTemplateDto,
  ) {
    return this.service.update(id, dto);
  }

  @Post('order')
  @Roles(...LAB_ORDERERS)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Order an entire template — expands to individual lab orders linked to an encounter',
  })
  orderFromTemplate(@Body() dto: OrderFromTemplateDto, @Req() req: any) {
    return this.service.orderFromTemplate(dto, authenticatedUserId(req));
  }
}
