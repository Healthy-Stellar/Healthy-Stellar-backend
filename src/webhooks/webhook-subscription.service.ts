import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { WebhookSubscription } from './entities/webhook-subscription.entity';
import { CreateWebhookSubscriptionDto } from './dto/create-webhook-subscription.dto';
import { UpdateWebhookSubscriptionDto } from './dto/update-webhook-subscription.dto';

@Injectable()
export class WebhookSubscriptionService {
  private readonly logger = new Logger(WebhookSubscriptionService.name);

  constructor(
    @InjectRepository(WebhookSubscription)
    private readonly subscriptionRepository: Repository<WebhookSubscription>,
  ) {}

  async createSubscription(dto: CreateWebhookSubscriptionDto): Promise<WebhookSubscription> {
    this.assertSafeWebhookUrl(dto.url);

    const secret = dto.secret ?? this.generateSecret();

    await this.pingEndpoint(dto.url, secret);

    const subscription = this.subscriptionRepository.create({
      ...dto,
      secret,
    });

    return this.subscriptionRepository.save(subscription);
  }

  async findAll(): Promise<WebhookSubscription[]> {
    return this.subscriptionRepository.find();
  }

  async findOne(id: string): Promise<WebhookSubscription> {
    const subscription = await this.subscriptionRepository.findOne({ where: { id } });

    if (!subscription) {
      throw new NotFoundException(`Webhook subscription ${id} not found`);
    }

    return subscription;
  }

  async updateSubscription(
    id: string,
    dto: UpdateWebhookSubscriptionDto,
  ): Promise<WebhookSubscription> {
    const subscription = await this.findOne(id);

    if (dto.url && dto.url !== subscription.url) {
      this.assertSafeWebhookUrl(dto.url);
      await this.pingEndpoint(dto.url, subscription.secret);
    }

    Object.assign(subscription, dto);

    return this.subscriptionRepository.save(subscription);
  }

  async removeSubscription(id: string): Promise<void> {
    const subscription = await this.findOne(id);
    await this.subscriptionRepository.remove(subscription);
  }

  /**
   * Rejects webhook URLs that could be used for SSRF against internal
   * infrastructure (cloud metadata, loopback, private/link-local ranges).
   */
  private assertSafeWebhookUrl(url: string): void {
    let parsed: URL;

    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('Webhook URL is not a valid URL');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException('Webhook URL must use http or https');
    }

    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

    if (this.isBlockedHost(hostname)) {
      throw new BadRequestException(
        'Webhook URL must not target a private, loopback, link-local, or metadata address',
      );
    }
  }

  private isBlockedHost(hostname: string): boolean {
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname === 'metadata.google.internal'
    ) {
      return true;
    }

    const ipv4 = this.parseIpv4(hostname);
    if (ipv4) {
      return this.isBlockedIpv4(ipv4);
    }

    if (hostname.includes(':')) {
      return this.isBlockedIpv6(hostname);
    }

    return false;
  }

  private parseIpv4(hostname: string): number[] | null {
    const parts = hostname.split('.');
    if (parts.length !== 4) {
      return null;
    }

    const octets: number[] = [];
    for (const part of parts) {
      if (!/^\d{1,3}$/.test(part)) {
        return null;
      }
      const value = Number(part);
      if (value > 255) {
        return null;
      }
      octets.push(value);
    }

    return octets;
  }

  private isBlockedIpv4(octets: number[]): boolean {
    const [a, b] = octets;

    // 0.0.0.0/8, 10.0.0.0/8, 127.0.0.0/8
    if (a === 0 || a === 10 || a === 127) {
      return true;
    }

    // 169.254.0.0/16 (link-local, includes 169.254.169.254 metadata)
    if (a === 169 && b === 254) {
      return true;
    }

    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) {
      return true;
    }

    // 192.168.0.0/16
    if (a === 192 && b === 168) {
      return true;
    }

    // 100.64.0.0/10 (carrier-grade NAT)
    if (a === 100 && b >= 64 && b <= 127) {
      return true;
    }

    return false;
  }

  private isBlockedIpv6(hostname: string): boolean {
    const normalized = hostname.toLowerCase();

    // Loopback ::1 and unspecified ::
    if (normalized === '::1' || normalized === '::') {
      return true;
    }

    // IPv4-mapped (::ffff:...) and IPv4-compatible addresses
    const mapped = normalized.match(/^::(?:ffff:)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (mapped) {
      const ipv4 = this.parseIpv4(mapped[1]);
      if (ipv4) {
        return this.isBlockedIpv4(ipv4);
      }
    }

    // Unique local (fc00::/7) and link-local (fe80::/10)
    if (/^f[cd][0-9a-f]{2}:/.test(normalized) || /^fe[89ab][0-9a-f]:/.test(normalized)) {
      return true;
    }

    return false;
  }

  private async pingEndpoint(url: string, secret: string): Promise<void> {
    this.assertSafeWebhookUrl(url);

    try {
      await axios.post(
        url,
        { event: 'ping' },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Secret': secret,
          },
          timeout: 5000,
        },
      );
    } catch (error) {
      this.logger.warn(`Webhook ping to ${url} failed: ${error.message}`);
      throw new BadRequestException('Webhook endpoint did not respond to ping');
    }
  }

  private generateSecret(): string {
    return require('crypto').randomBytes(32).toString('hex');
  }
}
