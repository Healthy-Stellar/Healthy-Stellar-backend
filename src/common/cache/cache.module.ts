import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheInvalidationService } from './cache-invalidation.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [CacheInvalidationService],
  exports: [CacheInvalidationService],
})
export class CacheModule {}
