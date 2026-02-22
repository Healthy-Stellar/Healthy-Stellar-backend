/* tslint:disable */
/* eslint-disable */
/**
 * MedChain API - AccessApi
 * NOTE: Auto-generated. Do not edit manually.
 */
import { AxiosPromise, AxiosRequestConfig } from 'axios';
import { BaseAPI, Configuration } from '../base';
import {
  AccessGrant,
  GrantAccessRequest,
  PaginatedAccessGrants,
} from '../models';

export interface ListGrantsParams {
  recordId?: string;
  page?: number;
  pageSize?: number;
}

export class AccessApi extends BaseAPI {
  constructor(configuration?: Configuration, basePath?: string) {
    super(configuration, basePath);
  }

  /**
   * List access grants associated with the authenticated user.
   */
  public listGrants(
    params: ListGrantsParams = {},
    options?: AxiosRequestConfig
  ): AxiosPromise<PaginatedAccessGrants> {
    return this.axios.get<PaginatedAccessGrants>('/access/grants', {
      params,
      ...options,
    });
  }

  /**
   * Grant another user access to a specific record.
   */
  public grantAccess(
    grantAccessRequest: GrantAccessRequest,
    options?: AxiosRequestConfig
  ): AxiosPromise<AccessGrant> {
    return this.axios.post<AccessGrant>('/access/grants', grantAccessRequest, options);
  }

  /**
   * Revoke an existing access grant by its ID.
   */
  public revokeAccess(
    grantId: string,
    options?: AxiosRequestConfig
  ): AxiosPromise<void> {
    return this.axios.delete<void>(`/access/grants/${encodeURIComponent(grantId)}`, options);
  }
}
