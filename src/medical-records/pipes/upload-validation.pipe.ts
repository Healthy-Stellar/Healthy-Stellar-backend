import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

/**
 * Maps each allowed MIME type to the hex magic bytes that must appear at the
 * start of the file buffer. Trusting only the Content-Type header is trivially
 * bypassed; we verify the actual file signature instead.
 */
const MAGIC_SIGNATURES: Record<string, Buffer[]> = {
  'image/jpeg': [Buffer.from([0xff, 0xd8, 0xff])],
  'image/png': [Buffer.from([0x89, 0x50, 0x4e, 0x47])],
  'image/gif': [Buffer.from('GIF87a'), Buffer.from('GIF89a')],
  'application/pdf': [Buffer.from('%PDF')],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    Buffer.from([0x50, 0x4b, 0x03, 0x04]), // ZIP-based (OOXML)
  ],
  'application/msword': [
    Buffer.from([0xd0, 0xcf, 0x11, 0xe0]), // OLE2 compound doc
  ],
  'text/plain': [], // no reliable magic bytes — allow any
};

export const ALLOWED_MIME_TYPES = Object.keys(MAGIC_SIGNATURES);

@Injectable()
export class UploadValidationPipe implements PipeTransform {
  transform(file: Express.Multer.File): Express.Multer.File {
    if (!file) throw new BadRequestException('No file provided');

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type "${file.mimetype}" is not permitted. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    const signatures = MAGIC_SIGNATURES[file.mimetype];
    if (signatures.length > 0) {
      const matches = signatures.some((sig) =>
        file.buffer.subarray(0, sig.length).equals(sig),
      );
      if (!matches) {
        throw new BadRequestException(
          `File content does not match declared type "${file.mimetype}"`,
        );
      }
    }

    return file;
  }
}
