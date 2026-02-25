/**
 * Records API
 * Manages medical records
 */

import { BaseApi } from './base.api';
import { Configuration } from '../configuration';
import { AxiosInstance, AxiosRequestConfig } from 'axios';

export interface CreateRecordRequest {
  patientId: string;
  recordType: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface RecordResponse {
  id: string;
  patientId: string;
  recordType: string;
  data: Record<string, any>;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  ipfsHash?: string;
  stellarTxHash?: string;
}

export interface ListRecordsResponse {
  data: RecordResponse[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export class RecordsApi extends BaseApi {
  public constructor(
    configuration?: Configuration,
    basePath?: string,
    axios?: AxiosInstance,
  ) {
    super(configuration, basePath, axios);
  }

  /**
   * Create a new medical record
   * @param createRecordRequest Record creation details
   * @param options Request options
   */
  public async createRecord(
    createRecordRequest: CreateRecordRequest,
    options?: AxiosRequestConfig,
  ): Promise<RecordResponse> {
    const localVarPath = `/records`;
    const localVarUrlObj = new URL(this.basePath + localVarPath, 'https://example.com');

    const config: AxiosRequestConfig = {
      method: 'POST',
      url: localVarUrlObj.toString(),
      data: createRecordRequest,
      ...options,
    };

    const response = await this.axios.request(config);
    return response.data;
  }

  /**
   * Get a medical record by ID
   * @param recordId Record ID
   * @param options Request options
   */
  public async getRecord(
    recordId: string,
    options?: AxiosRequestConfig,
  ): Promise<RecordResponse> {
    const localVarPath = `/records/{recordId}`.replace(
      `{recordId}`,
      String(recordId),
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
   * List medical records with pagination
   * @param page Page number (default: 1)
   * @param pageSize Page size (default: 10)
   * @param recordType Filter by record type
   * @param options Request options
   */
  public async listRecords(
    page?: number,
    pageSize?: number,
    recordType?: string,
    options?: AxiosRequestConfig,
  ): Promise<ListRecordsResponse> {
    const localVarPath = `/records`;

    const localVarQueryParameters: any = {};
    if (page !== undefined) {
      localVarQueryParameters['page'] = page;
    }
    if (pageSize !== undefined) {
      localVarQueryParameters['pageSize'] = pageSize;
    }
    if (recordType !== undefined) {
      localVarQueryParameters['recordType'] = recordType;
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
   * Update a medical record
   * @param recordId Record ID
   * @param data Updated record data
   * @param options Request options
   */
  public async updateRecord(
    recordId: string,
    data: Record<string, any>,
    options?: AxiosRequestConfig,
  ): Promise<RecordResponse> {
    const localVarPath = `/records/{recordId}`.replace(
      `{recordId}`,
      String(recordId),
    );

    const config: AxiosRequestConfig = {
      method: 'PATCH',
      url: this.basePath + localVarPath,
      data,
      ...options,
    };

    const response = await this.axios.request(config);
    return response.data;
  }

  /**
   * Delete a medical record
   * @param recordId Record ID
   * @param options Request options
   */
  public async deleteRecord(
    recordId: string,
    options?: AxiosRequestConfig,
  ): Promise<void> {
    const localVarPath = `/records/{recordId}`.replace(
      `{recordId}`,
      String(recordId),
    );

    const config: AxiosRequestConfig = {
      method: 'DELETE',
      url: this.basePath + localVarPath,
      ...options,
    };

    await this.axios.request(config);
  }
}
