import { INestApplication } from '@nestjs/common';
import helmet from 'helmet';

export const buildHelmetOptions = (): Parameters<typeof helmet>[0] => ({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  frameguard: {
    action: 'deny',
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  referrerPolicy: {
    policy: 'no-referrer',
  },
});

export function applySecurityHeaders(app: INestApplication): void {
  app.use(helmet(buildHelmetOptions()));
  app.use((_req, res, next) => {
    res.setHeader('X-XSS-Protection', '0');
    next();
  });
  app.getHttpAdapter().getInstance().disable('x-powered-by');
}
