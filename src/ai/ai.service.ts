import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class AiService implements OnModuleDestroy {
  private readonly logger = new Logger(AiService.name);
  private readonly redis: Redis;
  private readonly CACHE_TTL = 3600; // 1 hour in seconds
  private readonly OLLAMA_URL: string;
  private readonly OLLAMA_MODEL: string;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    });

    this.OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3:4b';
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  async summarizeMergedEvent(
    mergedEventId: string,
    mergedTitles: string[],
    eventCount: number,
  ): Promise<string> {
    const cacheKey = `ai:summary:${mergedEventId}`;

    // Check Redis cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      this.logger.log(`Cache hit for event ${mergedEventId}`);
      return cached;
    }

    // Build prompt
    const prompt =
      `You are a concise event summarizer. Generate a single one-line description for a merged event. ` +
      `This event was created by merging ${eventCount} overlapping events with the following titles: ${mergedTitles.join(', ')}. ` +
      `Reply with ONLY the one-line summary, nothing else. No thinking, no explanation.`;

    const summary = await this.callOllama(prompt);

    // Cache the result in Redis
    await this.redis.set(cacheKey, summary, 'EX', this.CACHE_TTL);
    this.logger.log(`Cached summary for event ${mergedEventId}`);

    return summary;
  }

  private async callOllama(prompt: string): Promise<string> {
    try {
      const response = await fetch(`${this.OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.OLLAMA_MODEL,
          prompt,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama responded with status ${response.status}`);
      }

      const data = (await response.json()) as { response: string };
      return data.response.trim();
    } catch (error) {
      this.logger.error(`Ollama call failed: ${error}`);
      return `Merged event from ${prompt.match(/\d+/)?.[0] || 'multiple'} overlapping events.`;
    }
  }
}
