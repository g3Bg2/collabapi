import { Controller, Post, Body } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('summarize')
  async summarize(
    @Body() body: { eventId: string; titles: string[]; eventCount: number },
  ) {
    const summary = await this.aiService.summarizeMergedEvent(
      body.eventId,
      body.titles,
      body.eventCount,
    );
    return { eventId: body.eventId, summary };
  }
}
