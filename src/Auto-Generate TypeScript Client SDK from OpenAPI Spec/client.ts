/**
 * MedChainClient — Unified entry point for the @medchain/sdk.
 *
 * Wraps all generated API classes into a single configurable client.
 *
 * @example
 * ```ts
 * import { MedChainClient } from '@medchain/sdk';
 *
 * const client = new MedChainClient({ basePath: 'https://api.medchain.io/v1' });
 * const { data } = await client.auth.login({ username: 'alice', password: 's3cr3t' });
 * client.setToken(data.token!);
 * ```
 */
import { Configuration } from './generated/base';
import { AuthApi, RecordsApi, AccessApi, AuditApi } from './generated/api';

export interface MedChainClientOptions {
  /** API base URL. Defaults to https://api.medchain.io/v1 */
  basePath?: string;
  /** Initial bearer token (can be updated via setToken) */
  token?: string;
}

export class MedChainClient {
  private _config: Configuration;
  private _basePath: string;

  public readonly auth: AuthApi;
  public readonly records: RecordsApi;
  public readonly access: AccessApi;
  public readonly audit: AuditApi;

  constructor(options: MedChainClientOptions = {}) {
    this._basePath = options.basePath ?? 'https://api.medchain.io/v1';
    this._config = {
      basePath: this._basePath,
      accessToken: options.token,
    };

    this.auth = new AuthApi(this._config, this._basePath);
    this.records = new RecordsApi(this._config, this._basePath);
    this.access = new AccessApi(this._config, this._basePath);
    this.audit = new AuditApi(this._config, this._basePath);
  }

  /**
   * Update the bearer token for all subsequent requests.
   * Call this after a successful login or token refresh.
   */
  public setToken(token: string): void {
    this._config.accessToken = token;
    // Re-create API instances with updated config so interceptors pick it up
    (this.auth as AuthApi & { configuration: Configuration }).configuration.accessToken = token;
    (this.records as RecordsApi & { configuration: Configuration }).configuration.accessToken = token;
    (this.access as AccessApi & { configuration: Configuration }).configuration.accessToken = token;
    (this.audit as AuditApi & { configuration: Configuration }).configuration.accessToken = token;
  }
}
