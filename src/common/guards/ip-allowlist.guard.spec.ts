import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { IpAllowlistGuard } from './ip-allowlist.guard';

function makeCtx(ip: string, headers: Record<string, string> = {}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ ip, headers, socket: { remoteAddress: ip } }),
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { IpAllowlistGuard } from './ip-allowlist.guard';

function makeContext(ip: string, headers: Record<string, string> = {}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        ip,
        socket: { remoteAddress: ip },
        headers,
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('IpAllowlistGuard', () => {
  const originalEnv = process.env.ADMIN_IP_ALLOWLIST;

  afterEach(() => {
    process.env.ADMIN_IP_ALLOWLIST = originalEnv;
  });

  it('allows an exact IP match', () => {
    process.env.ADMIN_IP_ALLOWLIST = '192.168.1.10';
    const guard = new IpAllowlistGuard();
    expect(guard.canActivate(makeCtx('192.168.1.10'))).toBe(true);
  });

  it('blocks an IP not in the allowlist', () => {
    process.env.ADMIN_IP_ALLOWLIST = '192.168.1.10';
    const guard = new IpAllowlistGuard();
    expect(() => guard.canActivate(makeCtx('10.0.0.1'))).toThrow(ForbiddenException);
  });

  it('allows an IP within a CIDR range', () => {
    process.env.ADMIN_IP_ALLOWLIST = '10.0.0.0/24';
    const guard = new IpAllowlistGuard();
    expect(guard.canActivate(makeCtx('10.0.0.55'))).toBe(true);
  });

  it('blocks an IP outside a CIDR range', () => {
    process.env.ADMIN_IP_ALLOWLIST = '10.0.0.0/24';
    const guard = new IpAllowlistGuard();
    expect(() => guard.canActivate(makeCtx('10.0.1.1'))).toThrow(ForbiddenException);
  });

  it('respects X-Forwarded-For header', () => {
    process.env.ADMIN_IP_ALLOWLIST = '203.0.113.5';
    const guard = new IpAllowlistGuard();
    const ctx = makeCtx('127.0.0.1', { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('respects X-Real-IP header', () => {
    process.env.ADMIN_IP_ALLOWLIST = '203.0.113.5';
    const guard = new IpAllowlistGuard();
    const ctx = makeCtx('127.0.0.1', { 'x-real-ip': '203.0.113.5' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('denies all when ADMIN_IP_ALLOWLIST is empty (fail-secure)', () => {
    process.env.ADMIN_IP_ALLOWLIST = '';
    const guard = new IpAllowlistGuard();
    expect(() => guard.canActivate(makeCtx('127.0.0.1'))).toThrow(ForbiddenException);
  });

  it('handles multiple entries including CIDR', () => {
    process.env.ADMIN_IP_ALLOWLIST = '192.168.1.1, 10.0.0.0/8';
    const guard = new IpAllowlistGuard();
    expect(guard.canActivate(makeCtx('10.99.1.2'))).toBe(true);
    expect(guard.canActivate(makeCtx('192.168.1.1'))).toBe(true);
    expect(() => guard.canActivate(makeCtx('172.16.0.1'))).toThrow(ForbiddenException);
  });
});
