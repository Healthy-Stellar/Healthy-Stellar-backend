import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { spawn } from 'child_process';
import { MedicalAttachment } from '../entities/medical-attachment.entity';
import { OcrJobDto } from '../dto/ocr-job.dto';
import { QUEUE_NAMES } from '../../queues/queue.constants';

const LOW_CONFIDENCE_THRESHOLD = 0.7;

@Processor(QUEUE_NAMES.OCR, { concurrency: 2 })
export class OcrProcessor extends WorkerHost {
  private readonly logger = new Logger(OcrProcessor.name);

  constructor(
    @InjectRepository(MedicalAttachment)
    private readonly attachmentRepo: Repository<MedicalAttachment>,
  ) {}

  async process(job: Job<OcrJobDto>): Promise<void> {
    const { attachmentId, filePath } = job.data;
    this.logger.log(`[ocr] Processing attachment ${attachmentId}`);

    const attachment = await this.attachmentRepo.findOne({ where: { id: attachmentId } });
    if (!attachment) {
      this.logger.warn(`[ocr] Attachment ${attachmentId} not found; skipping`);
      return;
    }

    try {
      const { text, confidence } = await this.runTesseract(filePath);

      attachment.ocrStatus = 'completed';
      attachment.extractedText = text;
      attachment.ocrConfidence = confidence;
      attachment.flaggedForReview = confidence < LOW_CONFIDENCE_THRESHOLD;

      await this.attachmentRepo.save(attachment);

      this.logger.log(
        `[ocr] Done attachment=${attachmentId} confidence=${confidence.toFixed(2)} ` +
          `flagged=${attachment.flaggedForReview}`,
      );
    } catch (err) {
      attachment.ocrStatus = 'failed';
      await this.attachmentRepo.save(attachment);
      this.logger.error(`[ocr] Failed attachment=${attachmentId}: ${err instanceof Error ? err.message : err}`);
      throw err;
    }
  }

  private runTesseract(filePath: string): Promise<{ text: string; confidence: number }> {
    return new Promise((resolve, reject) => {
      // `tesseract <file> stdout --dpi 300 tsv` emits TSV with per-word confidence
      const proc = spawn('tesseract', [filePath, 'stdout', '--dpi', '300', 'tsv'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const chunks: Buffer[] = [];
      const errChunks: Buffer[] = [];

      proc.stdout.on('data', (d: Buffer) => chunks.push(d));
      proc.stderr.on('data', (d: Buffer) => errChunks.push(d));

      proc.on('close', (code) => {
        if (code !== 0) {
          const msg = Buffer.concat(errChunks).toString().trim();
          return reject(new Error(`tesseract exited with code ${code}: ${msg}`));
        }

        const tsv = Buffer.concat(chunks).toString();
        const { text, confidence } = this.parseTsvOutput(tsv);
        resolve({ text, confidence });
      });

      proc.on('error', reject);
    });
  }

  private parseTsvOutput(tsv: string): { text: string; confidence: number } {
    const lines = tsv.trim().split('\n').slice(1); // skip header
    const words: string[] = [];
    let totalConf = 0;
    let wordCount = 0;

    for (const line of lines) {
      const cols = line.split('\t');
      const conf = parseFloat(cols[10] ?? '-1');
      const word = (cols[11] ?? '').trim();

      if (word && conf >= 0) {
        words.push(word);
        totalConf += conf;
        wordCount++;
      }
    }

    const confidence = wordCount > 0 ? totalConf / wordCount / 100 : 0;
    return { text: words.join(' '), confidence };
  }
}
