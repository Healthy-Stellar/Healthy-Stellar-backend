import { resolveTrustProxy } from './trust-proxy';

describe('resolveTrustProxy', () => {
  it('disables proxy trust when unset', () => {
    expect(resolveTrustProxy(undefined)).toBe(false);
    expect(resolveTrustProxy(null)).toBe(false);
    expect(resolveTrustProxy('')).toBe(false);
  });

  it('treats "false" as disabled', () => {
    expect(resolveTrustProxy('false')).toBe(false);
    expect(resolveTrustProxy(' FALSE ')).toBe(false);
  });

  it('treats "true" as trust-all', () => {
    expect(resolveTrustProxy('true')).toBe(true);
    expect(resolveTrustProxy(' TRUE ')).toBe(true);
  });

  it('parses a numeric hop count', () => {
    expect(resolveTrustProxy('1')).toBe(1);
    expect(resolveTrustProxy(' 2 ')).toBe(2);
    expect(resolveTrustProxy('0')).toBe(0);
  });

  it('parses named proxy ranges and CIDRs into an array', () => {
    expect(resolveTrustProxy('loopback, 172.16.0.0/12')).toEqual(['loopback', '172.16.0.0/12']);
    expect(resolveTrustProxy('10.0.0.1,2001:db8::/32')).toEqual(['10.0.0.1', '2001:db8::/32']);
  });

  it('rejects malformed entries instead of silently ignoring them', () => {
    expect(() => resolveTrustProxy('not-an-ip')).toThrow(/Invalid TRUST_PROXY/);
    expect(() => resolveTrustProxy('10.0.0.0/33')).toThrow(/prefix length/);
    expect(() => resolveTrustProxy('2001:db8::/129')).toThrow(/prefix length/);
    expect(() => resolveTrustProxy('loopback/8')).toThrow(/named ranges/);
    expect(() => resolveTrustProxy('10.0.0.0/8/9')).toThrow(/too many/);
  });
});
