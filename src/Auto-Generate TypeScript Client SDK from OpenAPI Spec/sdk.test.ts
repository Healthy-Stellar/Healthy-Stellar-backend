import axios from 'axios';
import { MedChainClient } from '../src/client';
import {
  AuthApi,
  RecordsApi,
  AccessApi,
  AuditApi,
} from '../src/generated/api';
import type {
  LoginResponse,
  MedicalRecord,
  PaginatedRecords,
  AccessGrant,
  PaginatedAccessGrants,
  PaginatedAuditLogs,
} from '../src/generated/models';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Create a mock axios instance that is returned by axios.create()
const mockAxiosInstance = {
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
};

(axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);

// Helper to reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
  (axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);
});

// ─── MedChainClient ──────────────────────────────────────────────────────────
describe('MedChainClient', () => {
  it('instantiates all API classes', () => {
    const client = new MedChainClient({ basePath: 'http://localhost:3000/v1' });
    expect(client.auth).toBeInstanceOf(AuthApi);
    expect(client.records).toBeInstanceOf(RecordsApi);
    expect(client.access).toBeInstanceOf(AccessApi);
    expect(client.audit).toBeInstanceOf(AuditApi);
  });

  it('setToken updates configuration on all API instances', () => {
    const client = new MedChainClient();
    client.setToken('test-token-abc');
    // @ts-expect-error accessing protected for test
    expect(client.auth.configuration.accessToken).toBe('test-token-abc');
    // @ts-expect-error accessing protected for test
    expect(client.records.configuration.accessToken).toBe('test-token-abc');
    // @ts-expect-error accessing protected for test
    expect(client.access.configuration.accessToken).toBe('test-token-abc');
    // @ts-expect-error accessing protected for test
    expect(client.audit.configuration.accessToken).toBe('test-token-abc');
  });
});

// ─── AuthApi ─────────────────────────────────────────────────────────────────
describe('AuthApi', () => {
  it('login() calls POST /auth/login with credentials', async () => {
    const response: LoginResponse = {
      token: 'jwt-token',
      expiresIn: 3600,
      userId: 'user-1',
    };
    mockAxiosInstance.post.mockResolvedValueOnce({ data: response });

    const api = new AuthApi({ basePath: 'http://localhost:3000/v1' });
    const result = await api.login({ username: 'alice', password: 'pass' });

    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/auth/login',
      { username: 'alice', password: 'pass' },
      undefined
    );
    expect(result.data).toEqual(response);
  });

  it('logout() calls POST /auth/logout', async () => {
    mockAxiosInstance.post.mockResolvedValueOnce({ data: undefined });
    const api = new AuthApi();
    await api.logout();
    expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth/logout', undefined, undefined);
  });
});

// ─── RecordsApi ──────────────────────────────────────────────────────────────
describe('RecordsApi', () => {
  it('listRecords() calls GET /records with query params', async () => {
    const response: PaginatedRecords = {
      data: [],
      total: 0,
      page: 1,
      pageSize: 20,
    };
    mockAxiosInstance.get.mockResolvedValueOnce({ data: response });

    const api = new RecordsApi();
    await api.listRecords({ patientId: 'p-1', page: 1, pageSize: 20 });

    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/records', {
      params: { patientId: 'p-1', page: 1, pageSize: 20 },
    });
  });

  it('getRecord() calls GET /records/:id', async () => {
    const record: MedicalRecord = { id: 'rec-1', patientId: 'p-1' };
    mockAxiosInstance.get.mockResolvedValueOnce({ data: record });

    const api = new RecordsApi();
    const result = await api.getRecord('rec-1');

    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/records/rec-1', undefined);
    expect(result.data.id).toBe('rec-1');
  });

  it('deleteRecord() calls DELETE /records/:id', async () => {
    mockAxiosInstance.delete.mockResolvedValueOnce({ data: undefined });
    const api = new RecordsApi();
    await api.deleteRecord('rec-1');
    expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/records/rec-1', undefined);
  });

  it('downloadRecord() uses responseType arraybuffer', async () => {
    const buffer = new ArrayBuffer(8);
    mockAxiosInstance.get.mockResolvedValueOnce({ data: buffer });

    const api = new RecordsApi();
    await api.downloadRecord('rec-1');

    expect(mockAxiosInstance.get).toHaveBeenCalledWith(
      '/records/rec-1/download',
      { responseType: 'arraybuffer' }
    );
  });
});

// ─── AccessApi ───────────────────────────────────────────────────────────────
describe('AccessApi', () => {
  it('grantAccess() calls POST /access/grants', async () => {
    const grant: AccessGrant = {
      id: 'grant-1',
      recordId: 'rec-1',
      granteeId: 'user-2',
      permissions: ['READ'],
    };
    mockAxiosInstance.post.mockResolvedValueOnce({ data: grant });

    const api = new AccessApi();
    const result = await api.grantAccess({
      recordId: 'rec-1',
      granteeId: 'user-2',
      permissions: ['READ'],
    });

    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/access/grants',
      expect.objectContaining({ recordId: 'rec-1' }),
      undefined
    );
    expect(result.data.id).toBe('grant-1');
  });

  it('revokeAccess() calls DELETE /access/grants/:id', async () => {
    mockAxiosInstance.delete.mockResolvedValueOnce({ data: undefined });
    const api = new AccessApi();
    await api.revokeAccess('grant-1');
    expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/access/grants/grant-1', undefined);
  });

  it('listGrants() passes query params', async () => {
    const response: PaginatedAccessGrants = { data: [], total: 0, page: 1, pageSize: 20 };
    mockAxiosInstance.get.mockResolvedValueOnce({ data: response });

    const api = new AccessApi();
    await api.listGrants({ recordId: 'rec-1', page: 1 });

    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/access/grants', {
      params: { recordId: 'rec-1', page: 1 },
    });
  });
});

// ─── AuditApi ────────────────────────────────────────────────────────────────
describe('AuditApi', () => {
  it('listAuditLogs() calls GET /audit/logs with filters', async () => {
    const response: PaginatedAuditLogs = { data: [], total: 0, page: 1, pageSize: 50 };
    mockAxiosInstance.get.mockResolvedValueOnce({ data: response });

    const api = new AuditApi();
    await api.listAuditLogs({ resourceId: 'rec-1', action: 'DOWNLOAD' });

    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/audit/logs', {
      params: { resourceId: 'rec-1', action: 'DOWNLOAD' },
    });
  });
});
