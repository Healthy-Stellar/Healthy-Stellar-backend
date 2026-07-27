import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PolicyService, CreatePolicyDto, UpdatePolicyDto } from '../services/policy.service';
import { PolicyGuard } from '../guards/policy.guard';
import { RequireAdmin } from '../decorators/policy.decorator';
import { Policy } from '../entities/access-policy.entity';

@Controller('policies')
@UseGuards(PolicyGuard)
export class PolicyController {
  constructor(private readonly policyService: PolicyService) {}

  @Post()
  @RequireAdmin()
  async create(@Body() createPolicyDto: CreatePolicyDto): Promise<Policy> {
    return this.policyService.create(createPolicyDto);
  }

  @Get()
  @RequireAdmin()
  async findAll(
    @Query('category') category?: string,
    @Query('active') active?: string,
  ): Promise<Policy[]> {
    const options: any = {};

    if (category) {
      options.where = { category };
    }

    if (active !== undefined) {
      options.where = {
        ...options.where,
        isActive: active === 'true',
      };
    }

    return this.policyService.findAll(options);
  }

  @Get(':id')
  @RequireAdmin()
  async findOne(@Param('id') id: string): Promise<Policy> {
    return this.policyService.findOne(id);
  }

  @Put(':id')
  @RequireAdmin()
  async update(@Param('id') id: string, @Body() updatePolicyDto: UpdatePolicyDto): Promise<Policy> {
    return this.policyService.update(id, updatePolicyDto);
  }

  @Delete(':id')
  @RequireAdmin()
  async remove(@Param('id') id: string): Promise<void> {
    return this.policyService.remove(id);
  }

  @Post(':id/activate')
  @RequireAdmin()
  async activate(@Param('id') id: string): Promise<Policy> {
    return this.policyService.activate(id);
  }

  @Post(':id/deactivate')
  @RequireAdmin()
  async deactivate(@Param('id') id: string): Promise<Policy> {
    return this.policyService.deactivate(id);
  }

  @Get('categories/:category')
  @RequireAdmin()
  async findByCategory(@Param('category') category: string): Promise<Policy[]> {
    return this.policyService.findActivePolicies(category);
  }
}
