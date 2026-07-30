import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bed } from './entities/bed.entity';
import { Room } from './entities/room.entity';
import { Ward } from './entities/ward.entity';
import { BedOccupancyService } from './bed-occupancy.service';
import { BedOccupancyController } from './bed-occupancy.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Bed, Room, Ward])],
  controllers: [BedOccupancyController],
  providers: [BedOccupancyService],
  exports: [BedOccupancyService],
})
export class BedOccupancyModule {}
