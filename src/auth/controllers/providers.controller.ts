import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { ProviderDirectoryQueryDto } from '../dto/provider-directory-query.dto';
import { OptionalJwtAuthGuard } from '../guards/optional-jwt-auth.guard';
import { ProviderDirectoryService } from '../services/provider-directory.service';

@ApiTags('Providers')
@Controller('providers')
export class ProvidersController {
  constructor(private readonly providerDirectoryService: ProviderDirectoryService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ ip: { limit: 30, ttl: 60000 }, user: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'Search provider directory',
    description:
      'Returns paginated providers. `stellarPublicKey` is returned only for authenticated requests.',
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'specialty', required: false, type: String })
  @ApiQuery({ name: 'role', required: false, enum: ['doctor', 'lab', 'insurer'] })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Providers returned successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  async findProviders(@Query() query: ProviderDirectoryQueryDto, @Req() req: Request) {
    const isAuthenticated = Boolean(req.user);
    return this.providerDirectoryService.searchProviders(query, isAuthenticated);
  }
}
