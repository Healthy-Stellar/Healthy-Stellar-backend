/* tslint:disable */
/* eslint-disable */
/**
 * MedChain API - AuthApi
 * NOTE: Auto-generated. Do not edit manually.
 */
import { AxiosPromise, AxiosRequestConfig } from 'axios';
import { BaseAPI, Configuration } from '../base';
import {
  LoginRequest,
  LoginResponse,
  RefreshRequest,
} from '../models';

export class AuthApi extends BaseAPI {
  constructor(configuration?: Configuration, basePath?: string) {
    super(configuration, basePath);
  }

  /**
   * Authenticate and obtain JWT token
   * @param loginRequest Login credentials
   * @param options Override Axios request config
   */
  public login(
    loginRequest: LoginRequest,
    options?: AxiosRequestConfig
  ): AxiosPromise<LoginResponse> {
    return this.axios.post<LoginResponse>('/auth/login', loginRequest, options);
  }

  /**
   * Refresh an expired access token using a refresh token
   * @param refreshRequest
   * @param options Override Axios request config
   */
  public refreshToken(
    refreshRequest: RefreshRequest,
    options?: AxiosRequestConfig
  ): AxiosPromise<LoginResponse> {
    return this.axios.post<LoginResponse>('/auth/refresh', refreshRequest, options);
  }

  /**
   * Invalidate the current bearer token (logout)
   * @param options Override Axios request config
   */
  public logout(options?: AxiosRequestConfig): AxiosPromise<void> {
    return this.axios.post<void>('/auth/logout', undefined, options);
  }
}
