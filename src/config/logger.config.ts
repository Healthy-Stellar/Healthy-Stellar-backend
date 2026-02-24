import { Params } from 'nestjs-pino';
import { Request } from 'express';
import * as path from 'path';

const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

// Sensitive fields to redact from logs
const redactPaths = [
  'req.headers.authorization',
  'req.body.password',
  'req.body.stellarSecretKey',
  'req.body.encryptionKey',
  'req.body.confirmPassword',
  'req.body.oldPassword',
  'req.body.newPassword',
  'res.headers.authorization',
  '*.password',
  '*.stellarSecretKey',
  '*.encryptionKey',
  '*.authorization',
];

export const loggerConfig: Params = {
  pinoHttp: {
    level: logLevel,
    
    // Custom request ID generator
    genReqId: (req: Request) => {
      return req.headers['x-request-id'] as string || crypto.randomUUID();
    },

    // Redact sensitive fields
    redact: {
      paths: redactPaths,
      censor: '[REDACTED]',
    },

    // Custom serializers
    serializers: {
      req: (req) => ({
        id: req.id,
        method: req.method,
        url: req.url,
        query: req.query,
        params: req.params,
        headers: {
          host: req.headers.host,
          'user-agent': req.headers['user-agent'],
          'content-type': req.headers['content-type'],
        },
        remoteAddress: req.remoteAddress,
        remotePort: req.remotePort,
      }),
      res: (res) => ({
        statusCode: res.statusCode,
        headers: {
          'content-type': res.getHeader('content-type'),
          'content-length': res.getHeader('content-length'),
        },
      }),
      err: (err) => ({
        type: err.type,
        message: err.message,
        stack: err.stack,
        code: err.code,
        statusCode: err.statusCode,
      }),
    },

    // Custom log message
    customLogLevel: (req, res, err) => {
      if (res.statusCode >= 500 || err) {
        return 'error';
      }
      if (res.statusCode >= 400) {
        return 'warn';
      }
      if (res.statusCode >= 300) {
        return 'info';
      }
      return 'info';
    },

    // Custom success message
    customSuccessMessage: (req, res) => {
      return `${req.method} ${req.url} ${res.statusCode}`;
    },

    // Custom error message
    customErrorMessage: (req, res, err) => {
      return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`;
    },

    // Custom attribute keys
    customAttributeKeys: {
      req: 'request',
      res: 'response',
      err: 'error',
      responseTime: 'duration',
    },

    // Transport configuration (production vs development)
    transport: isProduction && process.env.LOKI_HOST
      ? {
          target: path.join(__dirname, 'loki-transport.config.js'),
          options: {
            host: process.env.LOKI_HOST,
            basicAuth: process.env.LOKI_USERNAME && process.env.LOKI_PASSWORD
              ? {
                  username: process.env.LOKI_USERNAME,
                  password: process.env.LOKI_PASSWORD,
                }
              : undefined,
            labels: {
              app: process.env.APP_NAME || 'healthy-stellar-backend',
              environment: process.env.NODE_ENV || 'production',
            },
            batching: true,
            batchSize: 100,
            interval: 5000,
          },
        }
      : isProduction
      ? {
          target: 'pino/file',
          options: {
            destination: path.join(process.env.LOG_FILE_PATH || './logs', 'app.log'),
            mkdir: true,
          },
        }
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
            singleLine: false,
            messageFormat: '{levelLabel} - {msg}',
          },
        },

    // Base logger configuration
    base: {
      pid: process.pid,
      hostname: process.env.HOSTNAME || 'unknown',
      environment: process.env.NODE_ENV || 'development',
    },

    // Timestamp format
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  },
};
