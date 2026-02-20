import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AuditService } from '../audit/audit.service';
import { RateLimitingService } from '../rate-limiting/rate-limiting.service';
import { AuditAction, AuditSeverity } from '../entities/audit-log.entity';

interface AuthenticatedRequest extends Request {
  user?: { id: string; role: string };
  correlationId?: string;
  deviceId?: string;
}

/**
 * Main Healthcare Security Middleware
 * Handles request-level security checks, rate limiting, and audit logging
 */
@Injectable()
export class HealthcareSecurityMiddleware implements NestMiddleware {
  private readonly logger = new Logger(HealthcareSecurityMiddleware.name);

  // Paths that access PHI - need extra scrutiny
  private readonly PHI_PATHS = ['/patients', '/medical-records', '/prescriptions', '/lab-results', '/diagnoses'];
  private readonly AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/forgot-password'];
  private readonly ADMIN_PATHS = ['/admin'];

  constructor(
    private readonly auditService: AuditService,
    private readonly rateLimitingService: RateLimitingService,
  ) {}

  async use(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const ipAddress = this.getClientIp(req);
    const userId = req.user?.id;

    // 1. IP-level rate limiting (first line of defense)
    const ipResult = this.rateLimitingService.checkIpLimit(ipAddress);
    if (!ipResult.allowed) {
      this.logger.warn(`IP rate limit exceeded: ${ipAddress}`);
      res.status(429).json({
        statusCode: 429,
        message: 'Too many requests from this IP',
        retryAfter: ipResult.resetAt,
      });
      return;
    }

    // 2. Path-specific rate limiting
    const rateLimitProfile = this.getRateLimitProfile(req.path);
    const rateLimitKey = this.rateLimitingService.buildKey(ipAddress, userId, rateLimitProfile);
    const rateLimitResult = this.rateLimitingService.check(rateLimitKey, rateLimitProfile);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', this.rateLimitingService.PROFILES[rateLimitProfile]?.maxRequests || 100);
    res.setHeader('X-RateLimit-Remaining', rateLimitResult.remaining);
    res.setHeader('X-RateLimit-Reset', rateLimitResult.resetAt.toISOString());

    if (!rateLimitResult.allowed) {
      await this.auditService.log({
        userId,
        action: AuditAction.RATE_LIMIT_EXCEEDED,
        severity: AuditSeverity.WARNING,
        resource: req.path,
        ipAddress,
        requestMethod: req.method,
        requestPath: req.path,
        correlationId: req.correlationId,
        metadata: { profile: rateLimitProfile, blocked: rateLimitResult.blocked },
      });

      res.status(429).json({
        statusCode: 429,
        message: 'Healthcare API rate limit exceeded',
        retryAfter: rateLimitResult.resetAt,
      });
      return;
    }

    // 3. Security checks
    if (this.isSuspiciousRequest(req)) {
      await this.auditService.logSecurityViolation(
        {
          userId,
          ipAddress,
          requestPath: req.path,
          requestMethod: req.method,
          userAgent: req.headers['user-agent'],
          correlationId: req.correlationId,
        },
        'Suspicious request pattern detected',
      );
    }

    // 4. Audit PHI access
    if (this.isPhiPath(req.path) && userId) {
      await this.auditService.log({
        userId,
        userRole: req.user?.role,
        action: AuditAction.PHI_ACCESS,
        severity: AuditSeverity.INFO,
        resource: req.path,
        ipAddress,
        requestMethod: req.method,
        requestPath: req.path,
        userAgent: req.headers['user-agent'] as string,
        correlationId: req.correlationId,
        deviceId: req.deviceId,
        sessionId: req.headers['x-session-id'] as string,
      });
    }

    // 5. Response monitoring
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      if (duration > 5000) {
        this.logger.warn(`Slow request detected: ${req.method} ${req.path} took ${duration}ms`);
      }
    });

    next();
  }

  private getRateLimitProfile(path: string): string {
    if (this.AUTH_PATHS.some(p => path.startsWith(p))) return 'AUTH';
    if (this.ADMIN_PATHS.some(p => path.startsWith(p))) return 'ADMIN';
    if (this.PHI_PATHS.some(p => path.startsWith(p))) return 'PHI_ACCESS';
    if (path.startsWith('/audit')) return 'AUDIT_QUERY';
    if (path.startsWith('/incidents')) return 'INCIDENT_REPORT';
    if (path.startsWith('/devices/telemetry')) return 'DEVICE_TELEMETRY';
    return 'API_GENERAL';
  }

  private isPhiPath(path: string): boolean {
    return this.PHI_PATHS.some(p => path.startsWith(p));
  }

  private isSuspiciousRequest(req: Request): boolean {
    const userAgent = req.headers['user-agent'] || '';
    const path = req.path;

    // Check for common attack patterns
    const suspiciousPatterns = [
      /(\.\.\/)|(\.\.\\)/, // Path traversal
      /<script/i, // XSS attempt
      /union.*select/i, // SQL injection
      /base64_decode/i, // Code injection
      /eval\(/i, // Code execution
    ];

    const checkString = `${path}${JSON.stringify(req.query)}${JSON.stringify(req.body || {})}`;
    return suspiciousPatterns.some(pattern => pattern.test(checkString));
  }

  private getClientIp(req: Request): string {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
      return ips.split(',')[0].trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
  }
}
