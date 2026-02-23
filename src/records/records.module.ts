import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { Record } from './entities/record.entity';
import { RecordsController } from './controllers/records.controller';
import { RecordsService } from './services/records.service';
import { IpfsService } from './services/ipfs.service';
import { StellarService } from './services/stellar.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Record]),
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  ],
  controllers: [RecordsController],
  providers: [RecordsService, IpfsService, StellarService],
  exports: [RecordsService],
})
export class RecordsModule {}
