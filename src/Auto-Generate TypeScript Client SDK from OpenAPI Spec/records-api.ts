/* tslint:disable */
/* eslint-disable */
/**
 * MedChain API - RecordsApi
 * NOTE: Auto-generated. Do not edit manually.
 */
import { AxiosPromise, AxiosRequestConfig } from 'axios';
import { BaseAPI, Configuration } from '../base';
import { MedicalRecord, PaginatedRecords } from '../models';

export interface ListRecordsParams {
  patientId?: string;
  recordType?: string;
  page?: number;
  pageSize?: number;
}

export class RecordsApi extends BaseAPI {
  constructor(configuration?: Configuration, basePath?: string) {
    super(configuration, basePath);
  }

  /**
   * List medical records accessible to the authenticated user.
   * Supports filtering by patientId and recordType.
   */
  public listRecords(
    params: ListRecordsParams = {},
    options?: AxiosRequestConfig
  ): AxiosPromise<PaginatedRecords> {
    return this.axios.get<PaginatedRecords>('/records', {
      params,
      ...options,
    });
  }

  /**
   * Upload a new medical record with an attached file.
   * The file is sent as multipart/form-data; metadata is JSON-encoded.
   *
   * @param file        The binary file (Blob in browsers, Buffer/ReadStream in Node)
   * @param patientId   ID of the patient this record belongs to
   * @param metadata    JSON-stringified RecordMetadata
   * @param options     Override Axios request config
   */
  public uploadRecord(
    file: Blob | Buffer,
    patientId: string,
    metadata: string,
    options?: AxiosRequestConfig
  ): AxiosPromise<MedicalRecord> {
    const formData = new FormData();
    formData.append('file', file as Blob);
    formData.append('patientId', patientId);
    formData.append('metadata', metadata);

    return this.axios.post<MedicalRecord>('/records', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      ...options,
    });
  }

  /**
   * Fetch a single medical record by ID.
   */
  public getRecord(
    recordId: string,
    options?: AxiosRequestConfig
  ): AxiosPromise<MedicalRecord> {
    return this.axios.get<MedicalRecord>(`/records/${encodeURIComponent(recordId)}`, options);
  }

  /**
   * Soft-delete a medical record.
   */
  public deleteRecord(
    recordId: string,
    options?: AxiosRequestConfig
  ): AxiosPromise<void> {
    return this.axios.delete<void>(`/records/${encodeURIComponent(recordId)}`, options);
  }

  /**
   * Download the raw file for a record. Returns an ArrayBuffer.
   */
  public downloadRecord(
    recordId: string,
    options?: AxiosRequestConfig
  ): AxiosPromise<ArrayBuffer> {
    return this.axios.get<ArrayBuffer>(
      `/records/${encodeURIComponent(recordId)}/download`,
      { responseType: 'arraybuffer', ...options }
    );
  }
}
