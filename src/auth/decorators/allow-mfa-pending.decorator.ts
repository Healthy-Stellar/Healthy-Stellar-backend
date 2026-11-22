import { SetMetadata } from '@nestjs/common';

export const ALLOW_MFA_PENDING_KEY = 'allowMfaPending';

/**
 * Lets JwtAuthGuard accept the short-lived MFA-pending token issued by
 * POST /auth/login for MFA-enabled accounts. Use only on the endpoints that
 * complete the MFA challenge.
 */
export const AllowMfaPending = () => SetMetadata(ALLOW_MFA_PENDING_KEY, true);
