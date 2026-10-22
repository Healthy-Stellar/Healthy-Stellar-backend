import * as crypto from 'crypto';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PkceService } from './pkce.service';

// Helper: build a real S256 challenge from a verifier
function makeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

describe('PkceService', () => {
  let service: PkceService;

  beforeEach(() => {
    service = new PkceService();
  });

  // -------------------------------------------------------------------------
  // issueCode
  // -------------------------------------------------------------------------
  describe('issueCode', () => {
    it('returns a unique base64url code', () => {
      const c1 = service.issueCode('app', 'https://app/cb', 'u1', 'openid');
      const c2 = service.issueCode('app', 'https://app/cb', 'u1', 'openid');
      expect(c1).not.toBe(c2);
      expect(c1).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('stores a code_challenge when provided', () => {
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const challenge = makeChallenge(verifier);
      const code = service.issueCode('app', 'https://app/cb', 'u1', 'openid', challenge, 'S256');
      // Consuming with correct verifier must succeed
      expect(() =>
        service.consumeCode(code, 'app', 'https://app/cb', verifier),
      ).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // consumeCode — happy paths
  // -------------------------------------------------------------------------
  describe('consumeCode', () => {
    it('succeeds without PKCE for confidential clients', () => {
      const code = service.issueCode('client', 'https://app/cb', 'uid', 'openid');
      const entry = service.consumeCode(code, 'client', 'https://app/cb');
      expect(entry.userId).toBe('uid');
    });

    it('succeeds with correct PKCE verifier', () => {
      const verifier = 'abc123-verifier_value';
      const challenge = makeChallenge(verifier);
      const code = service.issueCode('client', 'https://app/cb', 'uid', 'openid', challenge, 'S256');
      const entry = service.consumeCode(code, 'client', 'https://app/cb', verifier);
      expect(entry.userId).toBe('uid');
    });

    it('is single-use: second consumption throws', () => {
      const code = service.issueCode('client', 'https://app/cb', 'uid', 'openid');
      service.consumeCode(code, 'client', 'https://app/cb');
      expect(() => service.consumeCode(code, 'client', 'https://app/cb')).toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for unknown code', () => {
      expect(() => service.consumeCode('bad', 'client', 'https://app/cb')).toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException on client_id mismatch', () => {
      const code = service.issueCode('client-a', 'https://app/cb', 'uid', 'openid');
      expect(() => service.consumeCode(code, 'client-b', 'https://app/cb')).toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException on redirect_uri mismatch', () => {
      const code = service.issueCode('client', 'https://app/cb', 'uid', 'openid');
      expect(() => service.consumeCode(code, 'client', 'https://evil/cb')).toThrow(
        BadRequestException,
      );
    });

    it('throws UnauthorizedException when verifier missing but challenge was set', () => {
      const challenge = makeChallenge('some-verifier');
      const code = service.issueCode('client', 'https://app/cb', 'uid', 'openid', challenge, 'S256');
      expect(() => service.consumeCode(code, 'client', 'https://app/cb')).toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when verifier does not match challenge', () => {
      const challenge = makeChallenge('correct-verifier');
      const code = service.issueCode('client', 'https://app/cb', 'uid', 'openid', challenge, 'S256');
      expect(() =>
        service.consumeCode(code, 'client', 'https://app/cb', 'wrong-verifier'),
      ).toThrow(UnauthorizedException);
    });
  });

  // -------------------------------------------------------------------------
  // verifyChallenge
  // -------------------------------------------------------------------------
  describe('verifyChallenge', () => {
    it('returns true for a valid S256 verifier/challenge pair', () => {
      const verifier = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
      const challenge = makeChallenge(verifier);
      expect(service.verifyChallenge(verifier, challenge)).toBe(true);
    });

    it('returns false for a mismatched pair', () => {
      const challenge = makeChallenge('correct');
      expect(service.verifyChallenge('wrong', challenge)).toBe(false);
    });
  });
});
