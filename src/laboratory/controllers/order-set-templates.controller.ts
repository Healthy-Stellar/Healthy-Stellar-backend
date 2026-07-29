import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { OrderSetTemplatesService } from '../services/order-set-templates.service';
import {
  CreateOrderSetTemplateDto,
  UpdateOrderSetTemplateDto,
} from '../dto/create-order-set-template.dto';
import { OrderFromTemplateDto } from '../dto/order-from-template.dto';

@ApiTags('order-set-templates')
@Controller('laboratory/order-set-templates')
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
  @ApiOperation({ summary: 'Admin: create a custom order-set template' })
  create(@Body() dto: CreateOrderSetTemplateDto) {
    const userId = 'system';
    return this.service.create(dto, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Admin: update a custom order-set template' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderSetTemplateDto,
  ) {
    return this.service.update(id, dto);
  }

  @Post('order')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Order an entire template — expands to individual lab orders linked to an encounter',
  })
  orderFromTemplate(@Body() dto: OrderFromTemplateDto) {
    const userId = 'system';
    return this.service.orderFromTemplate(dto, userId);
  }
}
