import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Whitelisted DTO for PATCH /medication-administration/:id
 *
 * Only notes and schedule-correction fields are permitted. Clinical fields
 * (status, patientId, medicationName, dose, administeredBy, etc.) are
 * intentionally excluded and must be changed through their dedicated
 * endpoints (e.g. the barcode/witness administration flow).
 *
 * The global ValidationPipe is expected to run with `whitelist: true` and
 * `forbidNonWhitelisted: true`, so any attempt to set a non-whitelisted
 * property will be rejected with a 400 response.
 */
export class UpdateMarDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsDateString()
  scheduledTime?: string;

  @IsOptional()
  @IsDateString()
  administrationDate?: string;
}

/**
 * DTO for voiding (strike-through) a medication administration record.
 *
 * Records are never hard-deleted; instead they are voided with a reason and
 * the actor who performed the void, preserving the legal audit trail.
 */
export class VoidMarDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;

  @IsString()
  @IsNotEmpty()
  voidedBy: string;

  @IsOptional()
  @IsString()
  nurseId?: string;
}