/**
 * Authentication API
 * Manages user authentication and JWT tokens
 */

import { BaseApi } from './base.api';
import { Configuration } from '../configuration';
import { AxiosInstance, AxiosRequestConfig } from 'axios';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role?: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn: number;
  user?: UserInfo;
}

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export class AuthApi extends BaseApi {
  public constructor(
    configuration?: Configuration,
    basePath?: string,
    axios?: AxiosInstance,
  ) {
    super(configuration, basePath, axios);
  }

  /**
   * Login with email and password
   * @param loginRequest Login credentials
   * @param options Request options
   */
  public async login(
    loginRequest: LoginRequest,
    options?: AxiosRequestConfig,
  ): Promise<TokenResponse> {
    const localVarPath = `/auth/login`;
    const localVarUrlObj = new URL(this.basePath + localVarPath, 'https://example.com');

    const config: AxiosRequestConfig = {
      method: 'POST',
      url: localVarUrlObj.toString(),
      data: loginRequest,
      ...options,
    };

    const response = await this.axios.request(config);
    return response.data;
  }

  /**
   * Register a new user
   * @param registerRequest Registration details
   * @param options Request options
   */
  public async register(
    registerRequest: RegisterRequest,
    options?: AxiosRequestConfig,
  ): Promise<TokenResponse> {
    const localVarPath = `/auth/register`;
    const localVarUrlObj = new URL(this.basePath + localVarPath, 'https://example.com');

    const config: AxiosRequestConfig = {
      method: 'POST',
      url: localVarUrlObj.toString(),
      data: registerRequest,
      ...options,
    };

    const response = await this.axios.request(config);
    return response.data;
  }

  /**
   * Refresh access token using refresh token
   * @param refreshTokenRequest Refresh token
   * @param options Request options
   */
  public async refreshToken(
    refreshTokenRequest: RefreshTokenRequest,
    options?: AxiosRequestConfig,
  ): Promise<TokenResponse> {
    const localVarPath = `/auth/refresh`;
    const localVarUrlObj = new URL(this.basePath + localVarPath, 'https://example.com');

    const config: AxiosRequestConfig = {
      method: 'POST',
      url: localVarUrlObj.toString(),
      data: refreshTokenRequest,
      ...options,
    };

    const response = await this.axios.request(config);
    return response.data;
  }

  /**
   * Logout the current user
   * @param options Request options
   */
  public async logout(options?: AxiosRequestConfig): Promise<void> {
    const localVarPath = `/auth/logout`;

    const config: AxiosRequestConfig = {
      method: 'POST',
      url: this.basePath + localVarPath,
      ...options,
    };

    await this.axios.request(config);
  }

  /**
   * Get current user information
   * @param options Request options
   */
  public async getCurrentUser(
    options?: AxiosRequestConfig,
  ): Promise<UserInfo> {
    const localVarPath = `/auth/me`;

    const config: AxiosRequestConfig = {
      method: 'GET',
      url: this.basePath + localVarPath,
      ...options,
    };

    const response = await this.axios.request(config);
    return response.data;
  }

  /**
   * Verify JWT token
   * @param token JWT token to verify
   * @param options Request options
   */
  public async verifyToken(
    token: string,
    options?: AxiosRequestConfig,
  ): Promise<{ valid: boolean; user?: UserInfo }> {
    const localVarPath = `/auth/verify`;

    const localVarQueryParameters: any = {
      token,
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
