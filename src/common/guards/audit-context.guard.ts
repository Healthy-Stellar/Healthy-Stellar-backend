import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AuditContextGuard implements CanActivate {
  constructor(private dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const userId = request.user?.id || 'anonymous';
    const ipAddress = request.ip || request.connection?.remoteAddress;
    const userAgent = request.headers['user-agent'];
    const requestId = request.headers['x-request-id'];
    const sessionId = request.session?.id;

    try {
      await this.dataSource.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId]);

      await this.dataSource.query(`SELECT set_config('app.current_ip_address', $1, true)`, [
        ipAddress,
      ]);

      await this.dataSource.query(`SELECT set_config('app.current_request_id', $1, true)`, [
        requestId,
      ]);
    } catch (error) {
      console.error('[AUDIT CONTEXT] Failed to set context:', error.message);
    }

    request.auditContext = {
      userId,
      ipAddress,
      userAgent,
      requestId,
      sessionId,
    };

    return true;
  }
}
