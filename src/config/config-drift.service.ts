import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { envValidationSchema } from './env.validation';

/**
 * Detects runtime configuration drift by re-validating the live process
 * environment against the declared schema on a schedule.
 *
 * Any value that was valid at startup but has since changed (e.g. via a
 * sidecar secret-injector or accidental mutation) will be logged as a warning
 * so operators can act before it causes a production incident.
 */
@Injectable()
export class ConfigDriftService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ConfigDriftService.name);
  private baseline: Record<string, string> = {};

  constructor(private readonly config: ConfigService) {}

  onApplicationBootstrap() {
    this.baseline = this.snapshot();
    this.logger.log('Configuration baseline captured');
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  detectDrift() {
    const current = this.snapshot();
    const drifted: string[] = [];

    for (const key of Object.keys(this.baseline)) {
      if (this.baseline[key] !== current[key]) {
        drifted.push(key);
      }
    }

    // Keys that appeared after startup
    for (const key of Object.keys(current)) {
      if (!(key in this.baseline)) {
        drifted.push(key);
      }
    }

    if (drifted.length > 0) {
      this.logger.warn(`Configuration drift detected for keys: ${drifted.join(', ')}`);
    }

    // Re-validate the full environment against the schema
    const { error } = envValidationSchema.validate(current);
    if (error) {
      const details = error.details.map((d) => d.message).join('; ');
      this.logger.error(`Runtime configuration is invalid: ${details}`);
    }
  }

  /** Returns the validated config snapshot (schema keys only). */
  private snapshot(): Record<string, string> {
    const raw: Record<string, string> = {};
    for (const key of Object.keys(envValidationSchema.describe().keys)) {
      const value = this.config.get<string>(key);
      if (value !== undefined) {
        raw[key] = String(value);
      }
    }
    return raw;
  }
}
