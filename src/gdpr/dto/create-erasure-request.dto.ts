import { IsOptional, IsUUID } from 'class-validator';

export class CreateErasureRequestDto {
  /**
   * Optional target subject for DPO/admin on-behalf-of flows.
   * Ignored for normal users; the service derives the subject from the
   * authenticated user and verifies the caller's role before honoring it.
   */
  @IsOptional()
  @IsUUID()
  subjectUserId?: string;
}