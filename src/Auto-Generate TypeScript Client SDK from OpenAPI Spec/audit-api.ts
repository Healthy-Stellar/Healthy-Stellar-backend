/* tslint:disable */
/* eslint-disable */
/**
 * MedChain API - AuditApi
 * NOTE: Auto-generated. Do not edit manually.
 */
import { AxiosPromise, AxiosRequestConfig } from 'axios';
import { BaseAPI, Configuration } from '../base';
import { PaginatedAuditLogs } from '../models';

export interface ListAuditLogsParams {
  actorId?: string;
  resourceId?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export class AuditApi extends BaseAPI {
  constructor(configuration?: Configuration, basePath?: string) {
    super(configuration, basePath);
  }

  /**
   * Retrieve paginated audit trail logs.
   * Supports filtering by actor, resource, action, and time range.
   */
  public listAuditLogs(
    params: ListAuditLogsParams = {},
    options?: AxiosRequestConfig
  ): AxiosPromise<PaginatedAuditLogs> {
    return this.axios.get<PaginatedAuditLogs>('/audit/logs', {
      params,
      ...options,
    });
  }
}
