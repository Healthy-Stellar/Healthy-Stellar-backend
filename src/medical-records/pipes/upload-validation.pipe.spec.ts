import { BadRequestException } from '@nestjs/common';
import { UploadValidationPipe, ALLOWED_MIME_TYPES } from './upload-validation.pipe';

function makeFile(
  mimetype: string,
  buffer: Buffer,
): Express.Multer.File {
  return {
    mimetype,
    buffer,
    originalname: 'test',
    fieldname: 'file',
    encoding: '7bit',
    size: buffer.length,
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
  };
}

describe('UploadValidationPipe', () => {
  let pipe: UploadValidationPipe;

  beforeEach(() => {
    pipe = new UploadValidationPipe();
  });

  it('throws when no file is provided', () => {
    expect(() => pipe.transform(null as any)).toThrow(BadRequestException);
  });

  it('throws for a disallowed MIME type', () => {
    const file = makeFile('application/x-executable', Buffer.from([0x7f, 0x45, 0x4c, 0x46]));
    expect(() => pipe.transform(file)).toThrow(BadRequestException);
  });

  it('accepts a valid JPEG with correct magic bytes', () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    const file = makeFile('image/jpeg', buf);
    expect(pipe.transform(file)).toBe(file);
  });

  it('rejects a JPEG MIME type with PNG magic bytes (spoofed Content-Type)', () => {
    const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    const file = makeFile('image/jpeg', pngMagic);
    expect(() => pipe.transform(file)).toThrow(BadRequestException);
  });

  it('accepts a valid PNG with correct magic bytes', () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const file = makeFile('image/png', buf);
    expect(pipe.transform(file)).toBe(file);
  });

  it('accepts a valid PDF with correct magic bytes', () => {
    const buf = Buffer.from('%PDF-1.4 ...');
    const file = makeFile('application/pdf', buf);
    expect(pipe.transform(file)).toBe(file);
  });

  it('rejects a PDF MIME type with wrong magic bytes', () => {
    const file = makeFile('application/pdf', Buffer.from('not a pdf'));
    expect(() => pipe.transform(file)).toThrow(BadRequestException);
  });

  it('accepts text/plain with any content (no magic bytes required)', () => {
    const file = makeFile('text/plain', Buffer.from('hello world'));
    expect(pipe.transform(file)).toBe(file);
  });

  it('ALLOWED_MIME_TYPES contains all expected types', () => {
    expect(ALLOWED_MIME_TYPES).toContain('image/jpeg');
    expect(ALLOWED_MIME_TYPES).toContain('image/png');
    expect(ALLOWED_MIME_TYPES).toContain('application/pdf');
    expect(ALLOWED_MIME_TYPES).toContain('text/plain');
  });
});
