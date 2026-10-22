import { PartialType } from '@nestjs/mapped-types';
import { CreateOutbreakThresholdDto } from './create-outbreak-threshold.dto';

export class UpdateOutbreakThresholdDto extends PartialType(CreateOutbreakThresholdDto) {}
