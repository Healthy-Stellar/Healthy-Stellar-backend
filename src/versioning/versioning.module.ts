import { Module } from '@nestjs/common';
import { ApiVersionsController } from './api-versions.controller';

@Module({
  controllers: [ApiVersionsController],
})
export class VersioningModule {}
