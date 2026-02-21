import { SetMetadata } from '@nestjs/common';

export const REQUIRE_FEATURE_KEY = 'require_feature';

/**
 * Decorator to require a specific feature to be enabled for the tenant
 * Usage: @RequireFeature('fhir_export_enabled')
 */
export const RequireFeature = (featureKey: string) => SetMetadata(REQUIRE_FEATURE_KEY, featureKey);
