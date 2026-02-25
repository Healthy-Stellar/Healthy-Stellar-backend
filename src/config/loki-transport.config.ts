import { build } from 'pino-abstract-transport';

interface LokiTransportOptions {
  host: string;
  basicAuth?: {
    username: string;
    password: string;
  };
  labels?: Record<string, string>;
  batching?: boolean;
  batchSize?: number;
  interval?: number;
}

export async function createLokiTransport(opts: LokiTransportOptions) {
  const {
    host,
    basicAuth,
    labels = {},
    batching = true,
    batchSize = 100,
    interval = 5000,
  } = opts;

  let batch: any[] = [];
  let timer: NodeJS.Timeout | null = null;

  const sendBatch = async () => {
    if (batch.length === 0) return;

    const streams = batch.map((log) => ({
      stream: {
        ...labels,
        level: log.level,
        context: log.context || 'app',
        environment: log.environment || 'development',
      },
      values: [[`${log.time}000000`, JSON.stringify(log)]],
    }));

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (basicAuth) {
        const auth = Buffer.from(
          `${basicAuth.username}:${basicAuth.password}`,
        ).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
      }

      await fetch(`${host}/loki/api/v1/push`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ streams }),
      });

      batch = [];
    } catch (error) {
      console.error('Failed to send logs to Loki:', error);
    }
  };

  return build(
    async function (source) {
      for await (const obj of source) {
        if (batching) {
          batch.push(obj);

          if (batch.length >= batchSize) {
            await sendBatch();
          }

          if (!timer) {
            timer = setInterval(sendBatch, interval);
          }
        } else {
          batch.push(obj);
          await sendBatch();
        }
      }
    },
    {
      async close() {
        if (timer) {
          clearInterval(timer);
        }
        await sendBatch();
      },
    },
  );
}
