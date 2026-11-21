import axios from 'axios';
import { promises as dns } from 'dns';
import { BadRequestException } from '@nestjs/common';
import { assertSafeOutboundUrl, safePost } from './safe-outbound-url';

jest.mock('dns', () => ({
  ...jest.requireActual('dns'),
  promises: { lookup: jest.fn() },
}));
jest.mock('axios');

const lookup = dns.lookup as unknown as jest.Mock;
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('assertSafeOutboundUrl', () => {
  beforeEach(() => lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]));
  afterEach(() => jest.clearAllMocks());

  it.each([
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.5:6379',
    'http://127.0.0.1/',
    'http://192.168.1.10/',
    'http://172.16.0.1/',
    'http://100.64.0.1/',
    'http://[::1]/',
    'http://[fd00::1]/',
    'http://[fe80::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://[::ffff:7f00:1]/',
    'http://localhost/',
    'http://metadata.google.internal/',
  ])('rejects %s', async (url) => {
    await expect(assertSafeOutboundUrl(url)).rejects.toThrow(BadRequestException);
    expect(lookup).not.toHaveBeenCalled();
  });

  it('rejects non-http protocols and invalid URLs', async () => {
    await expect(assertSafeOutboundUrl('ftp://example.com')).rejects.toThrow(BadRequestException);
    await expect(assertSafeOutboundUrl('not a url')).rejects.toThrow(BadRequestException);
  });

  it('rejects a hostname that resolves to a loopback address', async () => {
    lookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
    await expect(assertSafeOutboundUrl('https://evil.example.com')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects when any resolved address is private', async () => {
    lookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.1', family: 4 },
    ]);
    await expect(assertSafeOutboundUrl('https://mixed.example.com')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('returns the resolved public address', async () => {
    const target = await assertSafeOutboundUrl('https://example.com/hook');
    expect(target.address).toBe('93.184.216.34');
  });
});

describe('safePost', () => {
  it('disables redirects and pins the connection to the validated IP', async () => {
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    mockedAxios.post.mockResolvedValue({ status: 200, data: {} } as any);

    await safePost('https://example.com/hook', { a: 1 }, { timeout: 1000 });

    const config = mockedAxios.post.mock.calls[0][2] as any;
    expect(config.maxRedirects).toBe(0);
    const cb = jest.fn();
    config.httpsAgent.options.lookup('example.com', {}, cb);
    expect(cb).toHaveBeenCalledWith(null, '93.184.216.34', 4);
  });

  it('does not send a request to a blocked target', async () => {
    mockedAxios.post.mockClear();
    await expect(safePost('http://10.0.0.5', {})).rejects.toThrow(BadRequestException);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });
});
