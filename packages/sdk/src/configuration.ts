/**
 * Configuration for MedChain SDK
 */

export interface ConfigurationParameters {
  apiKey?: string | (() => string);
  accessToken?: string | (() => Promise<string>);
  basePath?: string;
  baseOptions?: any;
}

/**
 * Configuration class for MedChain SDK
 * Manages API credentials and base configuration
 */
export class Configuration {
  /**
   * API key for API key based authentication
   */
  apiKey?: string | (() => string);

  /**
   * Access token for Bearer token authentication
   */
  accessToken?: string | (() => Promise<string>);

  /**
   * Base path for API requests
   */
  basePath: string = 'https://api.medchain.io/v1';

  /**
   * Base options for axios requests
   */
  baseOptions: any = {};

  constructor(param: ConfigurationParameters = {}) {
    this.apiKey = param.apiKey;
    this.accessToken = param.accessToken;
    if (param.basePath) {
      this.basePath = param.basePath;
    }
    if (param.baseOptions) {
      this.baseOptions = param.baseOptions;
    }
  }

  /**
   * Get base path
   */
  getBasePath(): string {
    return this.basePath;
  }

  /**
   * Get API key
   */
  getApiKey(key: string): string | undefined {
    if (this.apiKey) {
      const apiKey = typeof this.apiKey === 'function' ? this.apiKey() : this.apiKey;
      return apiKey ? apiKey : undefined;
    }
    return undefined;
  }

  /**
   * Get access token
   */
  async getAccessToken(): Promise<string | undefined> {
    if (this.accessToken) {
      return typeof this.accessToken === 'function'
        ? await this.accessToken()
        : this.accessToken;
    }
    return undefined;
  }
}
