import { generateSignedUrl, verifySignedUrl } from './signed-url.util';

describe('signed-url.util', () => {
  describe('generateSignedUrl', () => {
    it('returns a path under /fhir/r4/export-files/{jobId}/{type}.ndjson', () => {
      const url = generateSignedUrl('job-1', 'Patient', 'application/fhir+ndjson');
      expect(url).toMatch(/^\/fhir\/r4\/export-files\/job-1\/Patient\.ndjson/);
    });

    it('includes expires as a future Unix timestamp', () => {
      const before = Math.floor(Date.now() / 1000);
      const url = generateSignedUrl('job-1', 'Patient', 'application/fhir+ndjson');
      const expires = parseInt(new URL(`http://localhost${url}`).searchParams.get('expires')!);
      expect(expires).toBeGreaterThan(before);
    });

    it('includes a sig query param that is a 64-char hex string (HMAC-SHA256)', () => {
      const url = generateSignedUrl('job-1', 'Patient', 'application/fhir+ndjson');
      const sig = new URL(`http://localhost${url}`).searchParams.get('sig')!;
      expect(sig).toMatch(/^[0-9a-f]{64}$/);
    });

    it('encodes the requested _format in the URL', () => {
      const url = generateSignedUrl('job-1', 'Patient', 'application/ndjson');
      expect(url).toContain('_format=');
      expect(url).toContain('application');
    });

    it('generates different signatures for different jobIds', () => {
      const url1 = generateSignedUrl('job-A', 'Patient', 'application/fhir+ndjson');
      const url2 = generateSignedUrl('job-B', 'Patient', 'application/fhir+ndjson');
      const sig1 = new URL(`http://localhost${url1}`).searchParams.get('sig');
      const sig2 = new URL(`http://localhost${url2}`).searchParams.get('sig');
      expect(sig1).not.toBe(sig2);
    });

    it('generates different signatures for different resource types', () => {
      const url1 = generateSignedUrl('job-1', 'Patient', 'application/fhir+ndjson');
      const url2 = generateSignedUrl('job-1', 'Consent', 'application/fhir+ndjson');
      const sig1 = new URL(`http://localhost${url1}`).searchParams.get('sig');
      const sig2 = new URL(`http://localhost${url2}`).searchParams.get('sig');
      expect(sig1).not.toBe(sig2);
    });
  });

  describe('verifySignedUrl', () => {
    it('returns true for a freshly generated URL', () => {
      const url = generateSignedUrl('job-1', 'Patient', 'application/fhir+ndjson');
      expect(verifySignedUrl(url)).toBe(true);
    });

    it('returns false when sig is tampered', () => {
      const url = generateSignedUrl('job-1', 'Patient', 'application/fhir+ndjson');
      const tampered = url.replace(/sig=[0-9a-f]+/, 'sig=' + 'a'.repeat(64));
      expect(verifySignedUrl(tampered)).toBe(false);
    });

    it('returns false when expires has passed', () => {
      // Build a URL with an already-expired timestamp
      const pastExpiry = Math.floor(Date.now() / 1000) - 1;
      const path = '/fhir/r4/export-files/job-1/Patient.ndjson';
      const url = `${path}?_format=application%2Ffhir%2Bndjson&expires=${pastExpiry}&sig=${'0'.repeat(64)}`;
      expect(verifySignedUrl(url)).toBe(false);
    });

    it('returns false when sig or expires is missing', () => {
      expect(verifySignedUrl('/fhir/r4/export-files/job-1/Patient.ndjson')).toBe(false);
    });

    it('returns false for a malformed URL string', () => {
      expect(verifySignedUrl('not-a-url')).toBe(false);
    });
  });
});
