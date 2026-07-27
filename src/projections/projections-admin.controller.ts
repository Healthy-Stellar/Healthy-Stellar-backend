import { Controller, Post, Get, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ProjectionRebuildService } from './rebuild/projection-rebuild.service';
import { ProjectionStatusDto } from './dto/projection-status.dto';

// Replace with your project's admin guard
// import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('admin/projections')
// @UseGuards(AdminGuard)
export class ProjectionsAdminController {
  constructor(private readonly rebuildService: ProjectionRebuildService) {}

  @Post(':name/rebuild')
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerRebuild(@Param('name') name: string): Promise<{ message: string }> {
    await this.rebuildService.triggerRebuild(name);
    return { message: `Rebuild queued for projector: ${name}` };
  }

  @Get(':name/status')
  async getStatus(@Param('name') name: string): Promise<ProjectionStatusDto> {
    return this.rebuildService.getStatus(name);
  }
}
