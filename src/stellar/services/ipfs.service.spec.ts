import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { IpfsService } from './ipfs.service';

describe('IpfsService', () => {
  let service: IpfsService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IpfsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'IPFS_GATEWAY') return 'https://test-ipfs.io/ipfs/';
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<IpfsService>(IpfsService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('fetch', () => {
    it('should fetch encrypted blob from IPFS', async () => {
      const mockCid = 'QmTest123';
      const mockPayload = 'encrypted-data-here';

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(mockPayload),
      });

      const result = await service.fetch(mockCid);

      expect(result).toEqual({
        cid: mockCid,
        encryptedPayload: mockPayload,
        metadata: expect.objectContaining({
          fetchedAt: expect.any(String),
          size: mockPayload.length,
        }),
      });

      expect(global.fetch).toHaveBeenCalledWith('https://test-ipfs.io/ipfs/QmTest123');
    });

    it('should throw error when IPFS fetch fails', async () => {
      const mockCid = 'QmTest123';

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      });

      await expect(service.fetch(mockCid)).rejects.toThrow('IPFS fetch failed: Not Found');
    });

    it('should throw error when network request fails', async () => {
      const mockCid = 'QmTest123';

      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(service.fetch(mockCid)).rejects.toThrow('Network error');
    });
  });
});
