/**
 * Access Control API
 * Manages access grants and permissions
 */

import { BaseApi } from './base.api';
import { Configuration } from '../configuration';
import { AxiosInstance, AxiosRequestConfig } from 'axios';

export interface GrantAccessRequest {
  recordId: string;
  recipientId: string;
  permissions: string[];
  expiresAt?: string;
}

export interface AccessGrant {
  id: string;
  recordId: string;
  grantedBy: string;
  grantedTo: string;
  permissions: string[];
  expiresAt?: string;
  revokedAt?: string;
  createdAt: string;
  updatedAt: string;
  ipfsHash?: string;
}

export interface ListAccessGrantsResponse {
  data: AccessGrant[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export class AccessApi extends BaseApi {
  public constructor(
    configuration?: Configuration,
    basePath?: string,
    axios?: AxiosInstance,
  ) {
    super(configuration, basePath, axios);
  }

  /**
   * Grant access to a record
   * @param grantAccessRequest Access grant details
   * @param options Request options
   */
  public async grantAccess(
    grantAccessRequest: GrantAccessRequest,
    options?: AxiosRequestConfig,
  ): Promise<AccessGrant> {
    const localVarPath = `/access/grant`;
    const localVarUrlObj = new URL(this.basePath + localVarPath, 'https://example.com');

    const config: AxiosRequestConfig = {
      method: 'POST',
      url: localVarUrlObj.toString(),
      data: grantAccessRequest,
      ...options,
    };

    const response = await this.axios.request(config);
    return response.data;
  }

  /**
   * Get access grant by ID
   * @param grantId Grant ID
   * @param options Request options
   */
  public async getAccessGrant(
    grantId: string,
    options?: AxiosRequestConfig,
  ): Promise<AccessGrant> {
    const localVarPath = `/access/grants/{grantId}`.replace(
      `{grantId}`,
      String(grantId),
    );

    const config: AxiosRequestConfig = {
      method: 'GET',
      url: this.basePath + localVarPath,
      ...options,
    };

    const response = await this.axios.request(config);
    return response.data;
  }

  /**
   * List access grants with pagination
   * @param recordId Filter by record ID
   * @param page Page number (default: 1)
   * @param pageSize Page size (default: 10)
   * @param options Request options
   */
  public async listAccessGrants(
    recordId?: string,
    page?: number,
    pageSize?: number,
    options?: AxiosRequestConfig,
  ): Promise<ListAccessGrantsResponse> {
    const localVarPath = `/access/grants`;

    const localVarQueryParameters: any = {};
    if (recordId !== undefined) {
      localVarQueryParameters['recordId'] = recordId;
    }
    if (page !== undefined) {
      localVarQueryParameters['page'] = page;
    }
    if (pageSize !== undefined) {
      localVarQueryParameters['pageSize'] = pageSize;
    }

    const config: AxiosRequestConfig = {
      method: 'GET',
      url: this.basePath + localVarPath,
      params: localVarQueryParameters,
      ...options,
    };

    const response = await this.axios.request(config);
    return response.data;
  }

  /**
   * Revoke access grant
   * @param grantId Grant ID
   * @param options Request options
   */
  public async revokeAccess(
    grantId: string,
    options?: AxiosRequestConfig,
  ): Promise<AccessGrant> {
    const localVarPath = `/access/grants/{grantId}/revoke`.replace(
      `{grantId}`,
      String(grantId),
    );

    const config: AxiosRequestConfig = {
      method: 'POST',
      url: this.basePath + localVarPath,
      ...options,
    };

    const response = await this.axios.request(config);
    return response.data;
  }

  /**
   * Check if user has access to record
   * @param recordId Record ID
   * @param options Request options
   */
  public async checkAccess(
    recordId: string,
    options?: AxiosRequestConfig,
  ): Promise<{ hasAccess: boolean; permissions: string[] }> {
    const localVarPath = `/access/check`;

    const localVarQueryParameters: any = {
      recordId,
    };

    const config: AxiosRequestConfig = {
      method: 'GET',
      url: this.basePath + localVarPath,
      params: localVarQueryParameters,
      ...options,
    };

    const response = await this.axios.request(config);
    return response.data;
  }
}
