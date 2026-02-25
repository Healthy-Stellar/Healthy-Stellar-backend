/**
 * Base API class for MedChain SDK
 * All API classes extend from this base
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { Configuration } from '../configuration';

export class BaseApi {
  protected configuration: Configuration;
  protected basePath: string;
  protected axios: AxiosInstance;

  constructor(configuration?: Configuration, basePath?: string, axios?: AxiosInstance) {
    this.configuration = configuration || new Configuration();
    this.basePath = basePath || this.configuration.getBasePath();
    this.axios =
      axios ||
      createAxiosInstance(this.basePath, this.configuration.baseOptions);
  }

  /**
   * Get axios instance
   */
  getAxios(): AxiosInstance {
    return this.axios;
  }

  /**
   * Set axios instance
   */
  setAxios(axios: AxiosInstance): void {
    this.axios = axios;
  }

  /**
   * Get base path
   */
  getBasePath(): string {
    return this.basePath;
  }

  /**
   * Set base path
   */
  setBasePath(basePath: string): void {
    this.basePath = basePath;
  }

  /**
   * Get configuration
   */
  getConfiguration(): Configuration {
    return this.configuration;
  }

  /**
   * Set configuration
   */
  setConfiguration(configuration: Configuration): void {
    this.configuration = configuration;
  }
}

/**
 * Create configured axios instance
 */
export function createAxiosInstance(
  basePath: string,
  baseOptions: any = {},
): AxiosInstance {
  return axios.create({
    baseURL: basePath,
    responseType: 'json',
    ...baseOptions,
  });
}
