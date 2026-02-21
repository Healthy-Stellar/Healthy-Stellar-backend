import { Test, TestingModule } from '@nestjs/testing';
import { WebhookSignatureMiddleware } from './webhook-signature.middleware';
import { UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';

describe('WebhookSignatureMiddleware', () => {
  let middleware: WebhookSignatureMiddleware;
  const mockSecret = 'test-webhook-secret-key';

  beforeEach(() => {
    process.env.WEBHOOK_SECRET = mockSecret;
    middleware = new WebhookSignatureMiddleware();
  });

  afterEach(() => {
    delete process.env.WEBHOOK_SECRET;
  });

  const createSignature = (timestamp: number, body: string, secret: string): string => {
    const payload = `${timestamp}.${body}`;
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return `${timestamp}.${signature}`;
  };

  it('should pass with valid signature', () => {
    const timestamp = Date.now();
    const body = JSON.stringify({ event: 'test' });
    const signature = createSignature(timestamp, body, mockSecret);

    const req: any = {
      headers: { 'x-webhook-signature': signature },
      rawBody: body,
    };
    const res: any = {};
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should reject with invalid signature', () => {
    const timestamp = Date.now();
    const body = JSON.stringify({ event: 'test' });
    const signature = createSignature(timestamp, body, 'wrong-secret');

    const req: any = {
      headers: { 'x-webhook-signature': signature },
      rawBody: body,
    };
    const res: any = {};
    const next = jest.fn();

    expect(() => middleware.use(req, res, next)).toThrow(UnauthorizedException);
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject expired timestamp (older than 5 minutes)', () => {
    const timestamp = Date.now() - (6 * 60 * 1000); // 6 minutes ago
    const body = JSON.stringify({ event: 'test' });
    const signature = createSignature(timestamp, body, mockSecret);

    const req: any = {
      headers: { 'x-webhook-signature': signature },
      rawBody: body,
    };
    const res: any = {};
    const next = jest.fn();

    expect(() => middleware.use(req, res, next)).toThrow(UnauthorizedException);
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject missing header', () => {
    const req: any = {
      headers: {},
      rawBody: JSON.stringify({ event: 'test' }),
    };
    const res: any = {};
    const next = jest.fn();

    expect(() => middleware.use(req, res, next)).toThrow(UnauthorizedException);
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject malformed signature header', () => {
    const req: any = {
      headers: { 'x-webhook-signature': 'invalid-format' },
      rawBody: JSON.stringify({ event: 'test' }),
    };
    const res: any = {};
    const next = jest.fn();

    expect(() => middleware.use(req, res, next)).toThrow(UnauthorizedException);
    expect(next).not.toHaveBeenCalled();
  });

  it('should throw error if WEBHOOK_SECRET is not set', () => {
    delete process.env.WEBHOOK_SECRET;
    expect(() => new WebhookSignatureMiddleware()).toThrow('WEBHOOK_SECRET environment variable is required');
  });
});
