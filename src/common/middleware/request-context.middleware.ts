import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DataSource } from 'typeorm';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private dataSource: DataSource) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const userId = (req as any).user?.id || 'anonymous';
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const requestId = (req.headers['x-request-id'] as string) || this.generateRequestId();
    const sessionId = (req as any).session?.id;

    req.headers['x-request-id'] = requestId;

    const queryRunner = this.dataSource.createQueryRunner();

    queryRunner.data = {
      userId,
      ipAddress,
      userAgent,
      requestId,
      sessionId,
    };

    (req as any).queryRunner = queryRunner;
    (req as any).auditContext = {
      userId,
      ipAddress,
      userAgent,
      requestId,
      sessionId,
    };

    res.on('finish', () => {
      if (queryRunner && !queryRunner.isReleased) {
        queryRunner.release();
      }
    });

    next();
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
