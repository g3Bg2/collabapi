import { AiService } from './ai.service';

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    disconnect: jest.fn(),
  }));
});

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('AiService', () => {
  let service: AiService;
  let mockRedis: { get: jest.Mock; set: jest.Mock; disconnect: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AiService();
    // Access the mocked redis instance
    mockRedis = (service as any).redis;
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  describe('summarizeMergedEvent', () => {
    it('should return cached summary on cache hit', async () => {
      mockRedis.get.mockResolvedValue('Cached: merged planning + demo');

      const result = await service.summarizeMergedEvent(
        'event-1',
        ['Planning', 'Demo'],
        2,
      );

      expect(result).toBe('Cached: merged planning + demo');
      expect(mockRedis.get).toHaveBeenCalledWith('ai:summary:event-1');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should call Ollama and cache on cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          response: '  Merged team sync from Planning and Demo.  ',
        }),
      });

      const result = await service.summarizeMergedEvent(
        'event-2',
        ['Planning', 'Demo'],
        2,
      );

      expect(result).toBe('Merged team sync from Planning and Demo.');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'ai:summary:event-2',
        'Merged team sync from Planning and Demo.',
        'EX',
        3600,
      );
    });

    it('should return fallback when Ollama fails', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const result = await service.summarizeMergedEvent(
        'event-3',
        ['A', 'B'],
        2,
      );

      expect(result).toContain('Merged event from');
      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('should return fallback when Ollama returns non-ok status', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      const result = await service.summarizeMergedEvent(
        'event-4',
        ['X'],
        1,
      );

      expect(result).toContain('Merged event from');
    });
  });
});
