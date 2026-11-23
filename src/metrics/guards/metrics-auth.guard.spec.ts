import * as crypto from 'node:crypto';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MetricsAuthGuard } from './metrics-auth.guard';

const TOKEN = 'test-metrics-token';

function createConfig(values: Record<string, string | undefined>): ConfigService {
  return {
    get: jest.fn((key: string, defaultValue?: string) =>
      values[key] !== undefined ? values[key] : defaultValue,
    ),
  } as unknown as ConfigService;
}

interface RequestOptions {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
  remoteAddress?: string;
}

function createContext(options: RequestOptions = {}): ExecutionContext {
  const request = {
    ip: options.ip,
    socket: { remoteAddress: options.remoteAddress ?? options.ip ?? '127.0.0.1' },
    headers: options.headers ?? {},
  };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('MetricsAuthGuard', () => {
  describe('token authentication', () => {
    it('requires the token even for loopback callers when no allowlist is configured', () => {
      const guard = new MetricsAuthGuard(createConfig({ METRICS_TOKEN: TOKEN }));

      expect(() => guard.canActivate(createContext({ ip: '127.0.0.1' }))).toThrow(
        UnauthorizedException,
      );
    });

    it('requires the token for private-network callers when no allowlist is configured', () => {
      const guard = new MetricsAuthGuard(createConfig({ METRICS_TOKEN: TOKEN }));

      expect(() => guard.canActivate(createContext({ ip: '10.1.2.3' }))).toThrow(
        UnauthorizedException,
      );
    });

    it('allows a request with the correct token from an external IP', () => {
      const guard = new MetricsAuthGuard(createConfig({ METRICS_TOKEN: TOKEN }));

      expect(
        guard.canActivate(
          createContext({
            ip: '203.0.113.10',
            headers: { 'x-metrics-token': TOKEN },
          }),
        ),
      ).toBe(true);
    });

    it('rejects a wrong token', () => {
      const guard = new MetricsAuthGuard(createConfig({ METRICS_TOKEN: TOKEN }));

      expect(() =>
        guard.canActivate(
          createContext({
            ip: '203.0.113.10',
            headers: { 'x-metrics-token': 'wrong-token' },
          }),
        ),
      ).toThrow(UnauthorizedException);
    });

    it('rejects a wrong token of a different length without throwing from timingSafeEqual', () => {
      const guard = new MetricsAuthGuard(createConfig({ METRICS_TOKEN: TOKEN }));

      expect(() =>
        guard.canActivate(
          createContext({
            ip: '203.0.113.10',
            headers: { 'x-metrics-token': 'x' },
          }),
        ),
      ).toThrow(UnauthorizedException);
    });

    it('rejects an array-valued token header', () => {
      const guard = new MetricsAuthGuard(createConfig({ METRICS_TOKEN: TOKEN }));

      expect(() =>
        guard.canActivate(
          createContext({
            ip: '203.0.113.10',
            headers: { 'x-metrics-token': [TOKEN] },
          }),
        ),
      ).toThrow(UnauthorizedException);
    });

    it('fails closed when METRICS_TOKEN is not configured', () => {
      const guard = new MetricsAuthGuard(createConfig({}));

      expect(() => guard.canActivate(createContext({ ip: '127.0.0.1' }))).toThrow(
        ForbiddenException,
      );
    });

    it('compares tokens with timingSafeEqual', () => {
      const spy = jest.spyOn(crypto, 'timingSafeEqual');
      const guard = new MetricsAuthGuard(createConfig({ METRICS_TOKEN: TOKEN }));

      guard.canActivate(
        createContext({
          ip: '203.0.113.10',
          headers: { 'x-metrics-token': TOKEN },
        }),
      );

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('spoofed forwarding headers', () => {
    it('does not let X-Forwarded-For: 127.0.0.1 bypass authentication', () => {
      const guard = new MetricsAuthGuard(createConfig({ METRICS_TOKEN: TOKEN }));

      expect(() =>
        guard.canActivate(
          createContext({
            ip: '203.0.113.10',
            headers: { 'x-forwarded-for': '127.0.0.1' },
          }),
        ),
      ).toThrow(UnauthorizedException);
    });

    it('does not let private or loopback forwarding headers bypass authentication', () => {
      const guard = new MetricsAuthGuard(createConfig({ METRICS_TOKEN: TOKEN }));

      expect(() =>
        guard.canActivate(
          createContext({
            ip: '203.0.113.10',
            headers: {
              'x-forwarded-for': '10.0.0.1, 192.168.1.10',
              'x-real-ip': '127.0.0.1',
            },
          }),
        ),
      ).toThrow(UnauthorizedException);
    });

    it('does not fall back to the socket peer address when req.ip is unavailable', () => {
      const guard = new MetricsAuthGuard(
        createConfig({
          METRICS_TOKEN: TOKEN,
          METRICS_ALLOWED_NETWORKS: '127.0.0.1,::1',
        }),
      );

      expect(() =>
        guard.canActivate(createContext({ ip: undefined, remoteAddress: '127.0.0.1' })),
      ).toThrow(UnauthorizedException);
    });
  });

  describe('explicit network allowlist', () => {
    it('allows an exact IPv4 address from the configured allowlist', () => {
      const guard = new MetricsAuthGuard(
        createConfig({
          METRICS_TOKEN: TOKEN,
          METRICS_ALLOWED_NETWORKS: '10.20.30.40',
        }),
      );

      expect(guard.canActivate(createContext({ ip: '10.20.30.40' }))).toBe(true);
    });

    it('allows an IPv4 CIDR from the configured allowlist', () => {
      const guard = new MetricsAuthGuard(
        createConfig({
          METRICS_TOKEN: TOKEN,
          METRICS_ALLOWED_NETWORKS: '10.20.30.0/24',
        }),
      );

      expect(guard.canActivate(createContext({ ip: '10.20.30.99' }))).toBe(true);
    });

    it('denies callers outside the configured allowlist', () => {
      const guard = new MetricsAuthGuard(
        createConfig({
          METRICS_TOKEN: TOKEN,
          METRICS_ALLOWED_NETWORKS: '10.20.30.0/24',
        }),
      );

      expect(() => guard.canActivate(createContext({ ip: '203.0.113.10' }))).toThrow(
        UnauthorizedException,
      );
    });

    it('matches loopback even when req.ip is IPv4-mapped IPv6', () => {
      const guard = new MetricsAuthGuard(
        createConfig({
          METRICS_TOKEN: TOKEN,
          METRICS_ALLOWED_NETWORKS: '127.0.0.1',
        }),
      );

      expect(guard.canActivate(createContext({ ip: '::ffff:127.0.0.1' }))).toBe(true);
    });

    it('supports exact IPv6 addresses and IPv6 CIDRs', () => {
      const guard = new MetricsAuthGuard(
        createConfig({
          METRICS_TOKEN: TOKEN,
          METRICS_ALLOWED_NETWORKS: '::1,2001:db8::/32',
        }),
      );

      expect(guard.canActivate(createContext({ ip: '::1' }))).toBe(true);
      expect(guard.canActivate(createContext({ ip: '2001:db8::42' }))).toBe(true);
      expect(() => guard.canActivate(createContext({ ip: '2001:db9::1' }))).toThrow(
        UnauthorizedException,
      );
    });

    it('ignores malformed allowlist entries and keeps failing closed', () => {
      const guard = new MetricsAuthGuard(
        createConfig({
          METRICS_TOKEN: TOKEN,
          METRICS_ALLOWED_NETWORKS: 'not-an-ip,10.20.30.0/99',
        }),
      );

      expect(() => guard.canActivate(createContext({ ip: '10.20.30.55' }))).toThrow(
        UnauthorizedException,
      );
    });

    it('allows an allowlisted caller without a token', () => {
      const guard = new MetricsAuthGuard(
        createConfig({
          METRICS_TOKEN: TOKEN,
          METRICS_ALLOWED_NETWORKS: '10.20.30.0/24',
        }),
      );

      expect(guard.canActivate(createContext({ ip: '10.20.30.5' }))).toBe(true);
    });
  });
});
