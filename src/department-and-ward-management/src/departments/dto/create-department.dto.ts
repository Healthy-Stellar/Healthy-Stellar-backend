import { IsString, IsArray, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsArray()
  @IsString({ each: true })
  specialties: string[];

  @IsString()
  @IsOptional()
  headOfDepartment?: string;

  @IsOptional()
  resources?: {
    staffCount: number;
    budgetAllocation: number;
    operatingHours: string;
  };

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
