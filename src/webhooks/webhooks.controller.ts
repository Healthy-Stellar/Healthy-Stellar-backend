import { Controller, Post, Body, HttpCode } from '@nestjs/common';

@Controller('webhooks')
export class WebhooksController {
  @Post('ipfs')
  @HttpCode(200)
  handleIpfsWebhook(@Body() payload: any) {
    // Handle IPFS pinning service webhook
    return { received: true };
  }

  @Post('stellar')
  @HttpCode(200)
  handleStellarWebhook(@Body() payload: any) {
    // Handle Stellar payment processor webhook
    return { received: true };
  }
}
