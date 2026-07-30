import { IsNotEmpty, IsString } from 'class-validator';

export class ImportHl7v2Dto {
  @IsString()
  @IsNotEmpty()
  message: string;
}
