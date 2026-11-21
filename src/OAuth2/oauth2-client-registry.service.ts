import { Injectable } from '@nestjs/common';
import { buildOAuth2ClientsConfig, OAuth2ClientConfig } from './oauth2-client.config';

/**
 * Registered-client lookup for the OAuth2 authorization server (Issue #792).
 * Unknown client_ids and unregistered redirect_uris must be rejected before
 * an authorization code is ever issued or a redirect is performed.
 */
@Injectable()
export class OAuth2ClientRegistryService {
  private readonly clients: Map<string, OAuth2ClientConfig>;

  constructor() {
    this.clients = new Map(
      buildOAuth2ClientsConfig().map((client) => [client.clientId, client]),
    );
  }

  getClient(clientId: string): OAuth2ClientConfig | undefined {
    return this.clients.get(clientId);
  }

  isRedirectUriRegistered(client: OAuth2ClientConfig, redirectUri: string): boolean {
    return client.redirectUris.includes(redirectUri);
  }
}
