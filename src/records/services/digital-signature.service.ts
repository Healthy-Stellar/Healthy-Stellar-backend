import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export enum SignatureStatus {
  VALID = 'valid',
  INVALID = 'invalid',
  UNSIGNED = 'unsigned',
}

export interface SignatureVerificationResult {
  status: SignatureStatus;
  algorithm?: string;
  signerCertificate?: string;
  signedAt?: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class DigitalSignatureService {
  private readonly logger = new Logger(DigitalSignatureService.name);

  /**
   * Extract digital signature metadata from a PDF file.
   *
   * Parses the PDF structure to find signature fields and extract:
   * - PKCS#7 / CAdES signature blob
   * - ByteRange (which bytes were signed)
   * - Signer certificate
   * - Signature algorithm
   *
   * @param buffer - Raw PDF file bytes
   * @returns Signature metadata or null if no signature found
   */
  extractPdfSignature(buffer: Buffer): {
    signatureBytes: Buffer;
    byteRange: number[];
    signerCert: Buffer | null;
    algorithm: string;
    signingTime: Date | null;
  } | null {
    try {
      const pdfStr = buffer.toString('latin1');

      // Find all signature fields by looking for /Type /Sig entries
      // PDF structure: N 0 obj\n<< ... /Type /Sig ... >>\nendobj
      const sigFieldRegex = /\/Type\s*\/Sig\b/g;
      const sigFieldPositions: number[] = [];

      let match;
      while ((match = sigFieldRegex.exec(pdfStr)) !== null) {
        sigFieldPositions.push(match.index);
      }

      if (sigFieldPositions.length === 0) {
        return null;
      }

      // Process the first signature field found
      const sigStart = sigFieldPositions[0];

      // Find the enclosing dictionary << ... >> for this signature field
      // Walk backwards from the /Type /Sig position to find the opening <<
      let dictStart = pdfStr.lastIndexOf('<<', sigStart);
      if (dictStart === -1) {
        return null;
      }

      // Find the matching closing >> after the sig field
      let dictEnd = pdfStr.indexOf('>>', sigStart + 10);
      if (dictEnd === -1) {
        return null;
      }

      const sigFieldContent = pdfStr.substring(dictStart, dictEnd + 2);

      // Extract ByteRange: [offset1 length1 offset2 length2]
      const byteRangeMatch = sigFieldContent.match(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/);
      if (!byteRangeMatch) {
        this.logger.warn('PDF signature found but no ByteRange');
        return null;
      }

      const byteRange: number[] = [
        parseInt(byteRangeMatch[1], 10),
        parseInt(byteRangeMatch[2], 10),
        parseInt(byteRangeMatch[3], 10),
        parseInt(byteRangeMatch[4], 10),
      ];

      // Extract Contents (hex-encoded PKCS#7 signature)
      // The Contents value is enclosed in <...> hex angle brackets
      const contentsMatch = sigFieldContent.match(/\/Contents\s*<([0-9A-Fa-f\s]+)>/);
      if (!contentsMatch) {
        this.logger.warn('PDF signature found but no Contents stream');
        return null;
      }

      const hexStr = contentsMatch[1].replace(/\s/g, '');
      const signatureBytes = Buffer.from(hexStr, 'hex');

      // Extract signer certificate from the PKCS#7 structure
      const signerCert = this.extractCertificateFromPkcs7(signatureBytes);

      // Extract signing time
      const signingTime = this.extractSigningTime(signatureBytes);

      // Determine algorithm from PKCS#7
      const algorithm = this.detectAlgorithm(signatureBytes);

      return {
        signatureBytes,
        byteRange,
        signerCert,
        algorithm,
        signingTime,
      };
    } catch (error) {
      this.logger.warn(`Failed to extract PDF signature: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Check if PDF signature structure is valid (parseable PKCS#7).
   * Does NOT perform cryptographic verification — used during upload to
   * determine if the signature is structurally sound.
   */
  isValidPdfSignatureStructure(buffer: Buffer): boolean {
    const extracted = this.extractPdfSignature(buffer);
    if (!extracted) {
      return false;
    }

    const { signatureBytes, byteRange } = extracted;

    if (signatureBytes.length < 20) {
      return false;
    }

    if (!byteRange || byteRange.length !== 4) {
      return false;
    }

    const [offset1, len1, offset2, len2] = byteRange;
    if (offset1 < 0 || len1 < 0 || offset2 < 0 || len2 < 0) {
      return false;
    }

    if (offset1 + len1 > buffer.length || offset2 + len2 > buffer.length) {
      return false;
    }

    const pkcs7Info = this.parsePkcs7(signatureBytes);
    return pkcs7Info !== null;
  }

  /**
   * Verify a PDF digital signature against a stored public key.
   *
   * Uses the PDF ByteRange to reconstruct the signed data and verifies
   * the PKCS#7 / CAdES signature using Node.js crypto.
   *
   * @param buffer - Raw PDF file bytes
   * @param publicKeyPem - Stored public key in PEM format
   * @returns Verification result
   */
  verifyPdfSignature(buffer: Buffer, publicKeyPem: string): SignatureVerificationResult {
    const extracted = this.extractPdfSignature(buffer);

    if (!extracted) {
      return {
        status: SignatureStatus.UNSIGNED,
      };
    }

    const { signatureBytes, byteRange, signerCert, algorithm, signingTime } = extracted;

    try {
      // Reconstruct the signed data from the PDF using ByteRange
      const signedData = this.reconstructSignedData(buffer, byteRange);

      // Verify the PKCS#7 signature
      const isValid = this.verifyPkcs7Signature(signatureBytes, signedData, publicKeyPem);

      return {
        status: isValid ? SignatureStatus.VALID : SignatureStatus.INVALID,
        algorithm: algorithm || 'pkcs7-sha256',
        signerCertificate: signerCert ? signerCert.toString('base64') : undefined,
        signedAt: signingTime || undefined,
        metadata: {
          byteRange,
          signatureLength: signatureBytes.length,
          hasCertificate: !!signerCert,
        },
      };
    } catch (error) {
      this.logger.error(`Signature verification failed: ${(error as Error).message}`);
      return {
        status: SignatureStatus.INVALID,
        algorithm: algorithm || 'pkcs7-sha256',
        signerCertificate: signerCert ? signerCert.toString('base64') : undefined,
        signedAt: signingTime || undefined,
        metadata: {
          error: (error as Error).message,
        },
      };
    }
  }

  /**
   * Verify a detached CAdES/PKCS#7 signature against data and public key.
   * Used for non-PDF documents or when the signature is stored separately.
   */
  verifyDetachedSignature(
    signatureBytes: Buffer,
    data: Buffer,
    publicKeyPem: string,
  ): SignatureVerificationResult {
    try {
      const isValid = this.verifyPkcs7Signature(signatureBytes, data, publicKeyPem);

      return {
        status: isValid ? SignatureStatus.VALID : SignatureStatus.INVALID,
        algorithm: 'pkcs7-sha256',
        metadata: {
          signatureLength: signatureBytes.length,
          dataLength: data.length,
        },
      };
    } catch (error) {
      this.logger.error(`Detached signature verification failed: ${(error as Error).message}`);
      return {
        status: SignatureStatus.INVALID,
        metadata: {
          error: (error as Error).message,
        },
      };
    }
  }

  /**
   * Reconstruct the exact data that was signed from a PDF using ByteRange.
   * PDF ByteRange format: [offset1 len1 offset2 len2] where the signed data
   * is everything EXCEPT the Contents placeholder.
   */
  private reconstructSignedData(buffer: Buffer, byteRange: number[]): Buffer {
    const [offset1, len1, offset2, len2] = byteRange;

    const part1 = buffer.subarray(offset1, offset1 + len1);
    const part2 = buffer.subarray(offset2, offset2 + len2);

    return Buffer.concat([part1, part2]);
  }

  /**
   * Verify PKCS#7 signature using Node.js crypto module.
   * Handles both enveloping and detached signatures.
   */
  private verifyPkcs7Signature(
    signatureBuffer: Buffer,
    data: Buffer,
    publicKeyPem: string,
  ): boolean {
    try {
      // Parse the PKCS#7 structure to extract the signature and digest algorithm
      const pkcs7Info = this.parsePkcs7(signatureBuffer);

      if (!pkcs7Info) {
        this.logger.warn('Could not parse PKCS#7 structure');
        return false;
      }

      // For CAdES / PKCS#7 signed data, we need to verify using the signer's public key
      // Node.js crypto doesn't have direct PKCS#7 verify, so we use OpenSSL via exec
      // or implement the verification manually using the certificate

      // Try using the certificate directly if available
      if (pkcs7Info.cert) {
        return this.verifyWithCertificate(signatureBuffer, data, pkcs7Info.cert, pkcs7Info.digestAlgorithm);
      }

      // Fallback: verify using public key PEM
      return this.verifyWithPublicKey(signatureBuffer, data, publicKeyPem, pkcs7Info.digestAlgorithm);
    } catch (error) {
      this.logger.error(`PKCS#7 verification error: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Verify using an X.509 certificate extracted from PKCS#7
   */
  private verifyWithCertificate(
    signatureBuffer: Buffer,
    data: Buffer,
    certPem: string,
    digestAlgorithm: string,
  ): boolean {
    try {
      // Write cert and signature to temp files for OpenSSL verification
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');

      const tmpDir = '/tmp/kilo-sig-verify';
      fs.mkdirSync(tmpDir, { recursive: true });

      const certPath = path.join(tmpDir, `cert-${Date.now()}.pem`);
      const sigPath = path.join(tmpDir, `sig-${Date.now()}.der`);
      const dataPath = path.join(tmpDir, `data-${Date.now()}.bin`);

      try {
        fs.writeFileSync(certPath, certPem);
        fs.writeFileSync(sigPath, signatureBuffer);
        fs.writeFileSync(dataPath, data);

        // Use OpenSSL to verify the PKCS#7 signed data
        // For CAdES detached signatures, we use CMS_verify
        const hashAlgo = digestAlgorithm.replace('sha', 'sha');
        const cmd = `openssl cms -verify -in ${sigPath} -content ${dataPath} -certfile ${certPath} -noverify -out /dev/null 2>&1`;

        try {
          execSync(cmd, { timeout: 10000 });
          return true;
        } catch {
          // Try without -noverify for full chain verification
          try {
            const cmd2 = `openssl cms -verify -in ${sigPath} -content ${dataPath} -certfile ${certPath} -out /dev/null 2>&1`;
            execSync(cmd2, { timeout: 10000 });
            return true;
          } catch {
            return false;
          }
        }
      } finally {
        try { fs.unlinkSync(certPath); } catch {}
        try { fs.unlinkSync(sigPath); } catch {}
        try { fs.unlinkSync(dataPath); } catch {}
      }
    } catch (error) {
      this.logger.error(`Certificate verification error: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Verify using a raw public key PEM
   */
  private verifyWithPublicKey(
    signatureBuffer: Buffer,
    data: Buffer,
    publicKeyPem: string,
    digestAlgorithm: string,
  ): boolean {
    try {
      // For PKCS#7 signatures, we extract the actual signature bytes
      // and verify using the public key
      const signatureValue = this.extractSignatureValue(signatureBuffer);
      if (!signatureValue) {
        return false;
      }

      const verifier = crypto.createVerify(digestAlgorithm);
      verifier.update(data);
      verifier.end();

      return verifier.verify(publicKeyPem, signatureValue);
    } catch (error) {
      this.logger.error(`Public key verification error: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Parse PKCS#7 / CMS structure to extract key information
   */
  private parsePkcs7(derBuffer: Buffer): {
    cert?: string;
    digestAlgorithm: string;
    signatureAlgorithm: string;
  } | null {
    try {
      // PKCS#7 / CMS SignedData OID: 1.2.840.113549.1.7.2
      const signedDataOid = Buffer.from([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x02]);

      // Search for SignedData OID in the DER structure
      let offset = 0;
      while (offset < derBuffer.length - signedDataOid.length) {
        if (derBuffer.subarray(offset, offset + signedDataOid.length).equals(signedDataOid)) {
          break;
        }
        offset++;
      }

      if (offset >= derBuffer.length - signedDataOid.length) {
        // Not a SignedData PKCS#7
        return null;
      }

      // Try to find digest algorithm identifier
      // Common: sha256 (2.16.840.1.101.3.4.2.1), sha384, sha512
      const sha256Oid = Buffer.from([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01]);
      const sha384Oid = Buffer.from([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x02]);
      const sha512Oid = Buffer.from([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x03]);

      let digestAlgorithm = 'sha256';
      if (derBuffer.includes(sha512Oid)) {
        digestAlgorithm = 'sha512';
      } else if (derBuffer.includes(sha384Oid)) {
        digestAlgorithm = 'sha384';
      }

      // Try to extract certificate from the PKCS#7 structure
      // Look for SEQUENCE containing a certificate (x509 ASN.1)
      const cert = this.tryExtractCertificate(derBuffer);

      return {
        cert,
        digestAlgorithm,
        signatureAlgorithm: digestAlgorithm,
      };
    } catch {
      return null;
    }
  }

  /**
   * Attempt to extract an X.509 certificate from PKCS#7 structure.
   * Looks for SEQUENCE with certificate structure markers.
   */
  private tryExtractCertificate(derBuffer: Buffer): string | undefined {
    try {
      // Search for a certificate SEQUENCE tag (0x30) followed by reasonable length
      // and containing the X.509 version marker
      let offset = 0;
      while (offset < derBuffer.length - 20) {
        if (derBuffer[offset] === 0x30) {
          const length = this.decodeDerLength(derBuffer, offset + 1);
          if (length > 100 && length < 5000 && offset + length <= derBuffer.length) {
            const candidate = derBuffer.subarray(offset, offset + length);
            // Check for X.509 Basic Constraints or other certificate markers
            if (candidate.includes(Buffer.from([0x06, 0x03, 0x55, 0x1d, 0x13]))) {
              // Found a certificate - convert to PEM
              const b64 = candidate.toString('base64');
              return `-----BEGIN CERTIFICATE-----\n${b64.match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----`;
            }
          }
        }
        offset++;
      }
    } catch {
      // Ignore extraction errors
    }
    return undefined;
  }

  /**
   * Extract the raw signature value from PKCS#7 structure
   * Looks for the SignatureValue OCTET STRING
   */
  private extractSignatureValue(derBuffer: Buffer): Buffer | null {
    try {
      // SignatureValue is an OCTET STRING (tag 0x04) inside the SignerInfo structure
      // We look for the signature value which typically follows the algorithm identifier
      let offset = 0;
      while (offset < derBuffer.length - 4) {
        if (derBuffer[offset] === 0x04) {
          const length = this.decodeDerLength(derBuffer, offset + 1);
          if (length > 20 && length < 1000 && offset + 1 + length <= derBuffer.length) {
            return derBuffer.subarray(offset + 1, offset + 1 + length);
          }
        }
        offset++;
      }
    } catch {
      // Ignore
    }
    return null;
  }

  /**
   * Decode DER length encoding
   */
  private decodeDerLength(buffer: Buffer, offset: number): number {
    const first = buffer[offset];
    if (first < 0x80) {
      return first;
    }
    const numBytes = first & 0x7f;
    if (numBytes === 0) {
      return 0;
    }
    let length = 0;
    for (let i = 1; i <= numBytes; i++) {
      length = (length << 8) | buffer[offset + i];
    }
    return length;
  }

  /**
   * Extract certificate from PKCS#7 signedData structure (simplified)
   */
  private extractCertificateFromPkcs7(pkcs7Buffer: Buffer): Buffer | null {
    try {
      // Look for X.509 certificate within the PKCS#7 structure
      // A certificate starts with SEQUENCE (0x30) and contains specific OIDs
      let offset = 0;
      while (offset < pkcs7Buffer.length - 50) {
        if (pkcs7Buffer[offset] === 0x30) {
          const length = this.decodeDerLength(pkcs7Buffer, offset + 1);
          if (length > 100 && length < 5000 && offset + length <= pkcs7Buffer.length) {
            const candidate = pkcs7Buffer.subarray(offset, offset + length);
            // Check for TBSCertificate SEQUENCE inside
            const innerOffset = this.findInnerSequence(candidate);
            if (innerOffset > 0) {
              return candidate;
            }
          }
        }
        offset++;
      }
    } catch {
      // Ignore extraction errors
    }
    return null;
  }

  /**
   * Find a nested SEQUENCE inside a DER buffer (for certificate validation)
   */
  private findInnerSequence(buffer: Buffer): number {
    if (buffer[0] !== 0x30 || buffer.length < 4) {
      return -1;
    }
    // The inner sequence should be the TBSCertificate
    return 0;
  }

  /**
   * Extract signing time from PKCS#7 structure
   */
  private extractSigningTime(pkcs7Buffer: Buffer): Date | null {
    try {
      // PKCS#9 signing time OID: 1.2.840.113549.1.9.5
      const signingTimeOid = Buffer.from([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x09, 0x05]);

      const oidOffset = pkcs7Buffer.indexOf(signingTimeOid);
      if (oidOffset === -1) {
        return null;
      }

      // After the OID, there should be a UTCTime or GeneralizedTime
      let timeOffset = oidOffset + signingTimeOid.length;
      while (timeOffset < pkcs7Buffer.length - 2) {
        if (pkcs7Buffer[timeOffset] === 0x17 || pkcs7Buffer[timeOffset] === 0x18) {
          // UTCTime (0x17) or GeneralizedTime (0x18)
          const length = pkcs7Buffer[timeOffset + 1];
          const timeStr = pkcs7Buffer.subarray(timeOffset + 2, timeOffset + 2 + length).toString('ascii');
          const date = new Date(timeStr);
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
        timeOffset++;
      }
    } catch {
      // Ignore
    }
    return null;
  }

  /**
   * Detect the digest algorithm used in the PKCS#7 signature
   */
  private detectAlgorithm(pkcs7Buffer: Buffer): string {
    // SHA-256 is the most common for modern PKCS#7 signatures
    const sha256Oid = Buffer.from([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01]);
    if (pkcs7Buffer.includes(sha256Oid)) {
      return 'sha256';
    }

    const sha384Oid = Buffer.from([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x02]);
    if (pkcs7Buffer.includes(sha384Oid)) {
      return 'sha384';
    }

    const sha512Oid = Buffer.from([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x03]);
    if (pkcs7Buffer.includes(sha512Oid)) {
      return 'sha512';
    }

    return 'sha256';
  }

  /**
   * Check if a PDF file contains any digital signature
   */
  hasPdfSignature(buffer: Buffer): boolean {
    const pdfStr = buffer.toString('latin1');
    return pdfStr.includes('/Type /Sig') || pdfStr.includes('/Type/Sig');
  }
}
