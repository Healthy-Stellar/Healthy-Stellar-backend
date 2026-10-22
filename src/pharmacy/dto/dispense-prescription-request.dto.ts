import { IsString, IsNotEmpty, IsOptional, IsInt, Min, MaxLength } from 'class-validator';

/**
 * Request body for POST /pharmacy/prescriptions/:id/dispense.
 *
 * This is intentionally simpler than dispense-prescription.dto.ts (which models
 * a multi-item, paper-signature dispense workflow used elsewhere in this
 * module) — this endpoint dispenses a single prescription's drug/quantity in
 * one transaction and records it as a dispensing-history entry.
 */
export class DispensePrescriptionRequestDto {
  @IsString()
  @IsNotEmpty()
  pharmacistId: string;

  /** Defaults to the full remaining prescribed quantity when omitted. */
  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;
}
