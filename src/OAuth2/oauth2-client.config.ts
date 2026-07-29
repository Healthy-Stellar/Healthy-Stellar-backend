export interface OAuth2ClientConfig {
  clientId: string;
  redirectUris: string[];
  /** Present for confidential clients; omitted for public (PKCE-only) clients */
  clientSecret?: string;
  requirePkce: boolean;
}

/**
 * Build the registry of clients allowed to use this OAuth2 authorization
 * server, from environment variables (Issue #792 — client registry /
 * redirect_uri allowlist for the SMART-on-FHIR authorize endpoint).
 *
 * Convention (supports N clients):
 *   OAUTH2_CLIENTS=ehr,mobile
 *
 *   OAUTH2_CLIENT_{NAME}_ID=...
 *   OAUTH2_CLIENT_{NAME}_REDIRECT_URIS=https://a.example.com/cb,https://b.example.com/cb
 *   OAUTH2_CLIENT_{NAME}_SECRET=...            # optional — omit for public clients
 *   OAUTH2_CLIENT_{NAME}_PKCE_REQUIRED=true    # optional — defaults to true unless a secret is set
 *
 * A client_id with no matching entry here is rejected by the authorize
 * endpoint, and a redirect_uri not listed for that client is rejected too.
 */
export function buildOAuth2ClientsConfig(): OAuth2ClientConfig[] {
  const rawClients = process.env.OAUTH2_CLIENTS ?? '';
  const clientNames = rawClients
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);

  return clientNames.map((name) => {
    const prefix = `OAUTH2_CLIENT_${name.toUpperCase()}`;
    const clientId = requireEnv(`${prefix}_ID`);
    const redirectUris = requireEnv(`${prefix}_REDIRECT_URIS`)
      .split(',')
      .map((uri) => uri.trim())
      .filter(Boolean);
    const clientSecret = process.env[`${prefix}_SECRET`] || undefined;
    const pkceRequiredEnv = process.env[`${prefix}_PKCE_REQUIRED`];
    const requirePkce = pkceRequiredEnv ? pkceRequiredEnv === 'true' : !clientSecret;

    return { clientId, redirectUris, clientSecret, requirePkce };
  });
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}
