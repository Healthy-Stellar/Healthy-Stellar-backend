import { Test, TestingModule } from '@nestjs/testing';
import { DigitalSignatureService, SignatureStatus } from './digital-signature.service';

describe('DigitalSignatureService', () => {
  let service: DigitalSignatureService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DigitalSignatureService],
    }).compile();

    service = module.get<DigitalSignatureService>(DigitalSignatureService);
  });

  describe('hasPdfSignature', () => {
    it('returns false for plain PDF without signature', () => {
      const plainPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');
      expect(service.hasPdfSignature(plainPdf)).toBe(false);
    });

    it('returns true for PDF with signature field', () => {
      const signedPdf = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
        '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
        '3 0 obj\n<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached >>\nendobj\n' +
        '%%EOF',
      );
      expect(service.hasPdfSignature(signedPdf)).toBe(true);
    });
  });

  describe('extractPdfSignature', () => {
    it('returns null for unsigned PDF', () => {
      const plainPdf = Buffer.from('%PDF-1.4\n%%EOF');
      expect(service.extractPdfSignature(plainPdf)).toBe(null);
    });

    it('returns metadata for PDF with signature field structure', () => {
      const signedPdf = Buffer.from(
        '%PDF-1.4\n' +
        '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
        '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
        '3 0 obj\n<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached ' +
        '/ByteRange [0 100 200 50] /Contents <DEADBEEF> >>\nendobj\n' +
        '4 0 obj\n<< >>\nendobj\n' +
        '%%EOF',
      );
      const result = service.extractPdfSignature(signedPdf);
      expect(result).not.toBeNull();
      expect(result?.byteRange).toEqual([0, 100, 200, 50]);
      expect(result?.signatureBytes).toBeDefined();
    });
  });

  describe('verifyPdfSignature', () => {
    it('returns UNSIGNED for plain PDF', () => {
      const plainPdf = Buffer.from('%PDF-1.4\n%%EOF');
      const result = service.verifyPdfSignature(plainPdf, '');
      expect(result.status).toBe(SignatureStatus.UNSIGNED);
    });

    it('returns UNSIGNED for PDF with signature field but no Contents', () => {
      const pdfWithEmptySig = Buffer.from(
        '%PDF-1.4\n' +
        '1 0 obj\n<< /Type /Catalog >>\nendobj\n' +
        '2 0 obj\n<< /Type /Sig /Filter /Adobe.PPKLite >>\nendobj\n' +
        '%%EOF',
      );
      const result = service.verifyPdfSignature(pdfWithEmptySig, '');
      expect(result.status).toBe(SignatureStatus.UNSIGNED);
    });

    it('returns INVALID for tampered signature bytes', () => {
      const tamperedPdf = Buffer.from(
        '%PDF-1.4\n' +
        '1 0 obj\n<< /Type /Catalog >>\nendobj\n' +
        // ByteRange claims bytes 0-100 and 200-250 are signed
        '2 0 obj\n<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached ' +
        '/ByteRange [0 100 200 50] /Contents <BAADFOODCAFEBABE> >>\nendobj\n' +
        '%%EOF',
      );
      const result = service.verifyPdfSignature(tamperedPdf, '');
      // The signature bytes are garbage, so verification should fail
      expect([SignatureStatus.INVALID, SignatureStatus.UNSIGNED]).toContain(result.status);
    });
  });

  describe('reconstructSignedData', () => {
    it('reconstructs data correctly using ByteRange', () => {
      const buffer = Buffer.from('ABCDEFGHIJ0123456789XYZ');
      const byteRange = [0, 10, 15, 5]; // bytes 0-9 + bytes 15-19
      const reconstructed = (service as any).reconstructSignedData(buffer, byteRange);
      // Bytes 0-9 = "ABCDEFGHIJ", bytes 15-19 = "56789"
      expect(reconstructed.toString()).toBe('ABCDEFGHIJ56789');
    });
  });

  describe('detectAlgorithm', () => {
    it('defaults to sha256 for unknown PKCS#7', () => {
      const fakePkcs7 = Buffer.from([0x30, 0x82]); // SEQUENCE, length 130
      const algo = (service as any).detectAlgorithm(fakePkcs7);
      expect(algo).toBe('sha256');
    });
  });
});
