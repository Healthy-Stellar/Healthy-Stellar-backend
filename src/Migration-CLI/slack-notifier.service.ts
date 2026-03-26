import { Injectable, Logger } from '@nestjs/common';

export interface SlackMigrationPayload {
  event: 'migration_started' | 'migration_success' | 'migration_failed' | 'migration_reverted';
  migrationNames: string[];
  executor: string;
  environment: string;
  durationMs?: number;
  error?: string;
  backupPath?: string;
  dryRun?: boolean;
}

interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  fields?: Array<{ type: string; text: string }>;
  elements?: Array<{ type: string; text: string }>;
}

@Injectable()
export class SlackNotifierService {
  private readonly logger = new Logger(SlackNotifierService.name);
  private readonly webhookUrl = process.env.MIGRATION_SLACK_WEBHOOK_URL;
  private readonly channel =
    process.env.MIGRATION_SLACK_CHANNEL ?? '#ops-migrations';

  /**
   * Send a notification to the ops Slack channel.
   * Silently no-ops if MIGRATION_SLACK_WEBHOOK_URL is not configured.
   */
  async notify(payload: SlackMigrationPayload): Promise<void> {
    if (!this.webhookUrl) {
      this.logger.debug('MIGRATION_SLACK_WEBHOOK_URL not set — skipping Slack notification.');
      return;
    }

    // Only notify for production unless MIGRATION_SLACK_ALL_ENVS=true
    const notifyAllEnvs = process.env.MIGRATION_SLACK_ALL_ENVS === 'true';
    if (
      !notifyAllEnvs &&
      payload.environment !== 'production'
    ) {
      return;
    }

    const message = this.buildMessage(payload);

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        const body = await response.text();
        this.logger.warn(
          `Slack notification failed (${response.status}): ${body}`,
        );
      } else {
        this.logger.debug('Slack notification sent.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Slack notification error: ${message}`);
    }
  }

  private buildMessage(payload: SlackMigrationPayload): Record<string, unknown> {
    const emoji = this.resolveEmoji(payload.event);
    const title = this.resolveTitle(payload);
    const color = this.resolveColor(payload.event);

    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: `${emoji} ${title}`, emoji: true },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Environment*\n${payload.environment}`,
          },
          {
            type: 'mrkdwn',
            text: `*Executor*\n${payload.executor}`,
          },
          {
            type: 'mrkdwn',
            text: `*Migrations*\n${payload.migrationNames.map((n) => `\`${n}\``).join('\n') || 'none'}`,
          },
          ...(payload.durationMs !== undefined
            ? [
                {
                  type: 'mrkdwn',
                  text: `*Duration*\n${(payload.durationMs / 1000).toFixed(2)}s`,
                },
              ]
            : []),
        ],
      },
    ];

    if (payload.backupPath) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Backup*: \`${payload.backupPath}\``,
        },
      });
    }

    if (payload.error) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Error*:\n\`\`\`${payload.error.substring(0, 1000)}\`\`\``,
        },
      });
    }

    if (payload.dryRun) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':test_tube: *This was a dry-run — no changes were applied.*',
        },
      });
    }

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `<!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`,
        },
      ],
    });

    return {
      channel: this.channel,
      attachments: [
        {
          color,
          blocks,
        },
      ],
    };
  }

  private resolveEmoji(event: SlackMigrationPayload['event']): string {
    const map: Record<SlackMigrationPayload['event'], string> = {
      migration_started: ':hourglass_flowing_sand:',
      migration_success: ':white_check_mark:',
      migration_failed: ':x:',
      migration_reverted: ':rewind:',
    };
    return map[event];
  }

  private resolveTitle(payload: SlackMigrationPayload): string {
    const envTag = `[${payload.environment.toUpperCase()}]`;
    switch (payload.event) {
      case 'migration_started':
        return `${envTag} Database Migration Started`;
      case 'migration_success':
        return `${envTag} Database Migration Succeeded`;
      case 'migration_failed':
        return `${envTag} Database Migration FAILED`;
      case 'migration_reverted':
        return `${envTag} Database Migration Reverted`;
    }
  }

  private resolveColor(event: SlackMigrationPayload['event']): string {
    const map: Record<SlackMigrationPayload['event'], string> = {
      migration_started: '#FFA500',
      migration_success: '#36a64f',
      migration_failed: '#FF0000',
      migration_reverted: '#9B59B6',
    };
    return map[event];
  }
}
