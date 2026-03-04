import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Event, EventStatus } from '../entities/events.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { User } from '../entities/user.entity';
import { CreateEventDto } from '../dto/createEventDto';
import { UpdateEventDto } from '../dto/updateEventDto';
import { AiService } from '../ai/ai.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly aiService: AiService,
    @InjectQueue('bulk-events') private eventsQueue: Queue,
  ) {}

  async createEvent(createEventDto: CreateEventDto): Promise<Event> {
    const { inviteeIds, ...eventData } = createEventDto;

    const event = this.eventRepository.create(eventData);

    if (inviteeIds?.length) {
      event.invitees = await this.userRepository.findBy({
        id: In(inviteeIds),
      });
    }

    return this.eventRepository.save(event);
  }

  async getEventById(id: string): Promise<Event> {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: ['invitees'],
    });
    if (!event) {
      throw new NotFoundException(`Event with id ${id} not found`);
    }
    return event;
  }

  async updateEvent(
    id: string,
    updateEventDto: UpdateEventDto,
  ): Promise<Event> {
    const event = await this.getEventById(id);
    const { inviteeIds, ...updateData } = updateEventDto;

    Object.assign(event, updateData);

    if (inviteeIds !== undefined) {
      event.invitees = inviteeIds.length
        ? await this.userRepository.findBy({ id: In(inviteeIds) })
        : [];
    }

    return this.eventRepository.save(event);
  }

  async deleteEvent(id: string): Promise<void> {
    const result = await this.eventRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Event with id ${id} not found`);
    }
  }

  // --- Conflict Detection ---

  async getConflicts(
    userId: string,
  ): Promise<{ eventA: Event; eventB: Event }[]> {
    const events = await this.eventRepository
      .createQueryBuilder('event')
      .innerJoin('event.invitees', 'user', 'user.id = :userId', { userId })
      .orderBy('event.startTime', 'ASC')
      .getMany();

    const conflicts: { eventA: Event; eventB: Event }[] = [];
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        if (this.isOverlapping(events[i], events[j])) {
          conflicts.push({ eventA: events[i], eventB: events[j] });
        }
      }
    }
    return conflicts;
  }

  // --- Merge All Overlapping Events ---

  async mergeAllEvents(userId: string): Promise<{
    merged: Event[];
    auditLogs: AuditLog[];
    summaries: Record<string, string>;
  }> {
    const events = await this.eventRepository
      .createQueryBuilder('event')
      .innerJoinAndSelect('event.invitees', 'user', 'user.id = :userId', {
        userId,
      })
      .orderBy('event.startTime', 'ASC')
      .getMany();

    // Group overlapping events into clusters
    const clusters = this.buildOverlapClusters(events);

    // Only process clusters with 2+ events
    const mergeClusters = clusters.filter((c) => c.length > 1);
    if (mergeClusters.length === 0) {
      return { merged: [], auditLogs: [], summaries: {} };
    }

    const mergedEvents: Event[] = [];
    const auditLogs: AuditLog[] = [];
    const clusterTitles: Map<string, string[]> = new Map();

    await this.dataSource.transaction(async (manager) => {
      for (const cluster of mergeClusters) {
        const mergedEvent = this.combineEvents(cluster);
        const titles = cluster.map((e) => e.title);

        const saved = await manager.save(Event, mergedEvent);
        mergedEvents.push(saved);
        clusterTitles.set(saved.id, titles);

        const auditLog = manager.create(AuditLog, {
          action: 'MERGE',
          oldEventIds: cluster.map((e) => e.id),
          newEventId: saved.id,
          userId,
          details: {
            mergedTitles: titles,
            eventCount: cluster.length,
          },
        });
        const savedLog = await manager.save(AuditLog, auditLog);
        auditLogs.push(savedLog);

        // Remove old events
        const oldIds = cluster.map((e) => e.id);
        await manager.delete(Event, oldIds);
      }
    });

    // Generate AI summaries for each merged event (outside transaction)
    const summaries: Record<string, string> = {};
    await Promise.all(
      mergedEvents.map(async (event) => {
        const titles = clusterTitles.get(event.id) || [];
        summaries[event.id] = await this.aiService.summarizeMergedEvent(
          event.id,
          titles,
          titles.length,
        );
      }),
    );

    return { merged: mergedEvents, auditLogs, summaries };
  }

  // --- Batch Create ---

  async batchCreateEvents(createEventDtos: CreateEventDto[]): Promise<{
    message: string;
    jobId: string | number;
  }> {
    if (createEventDtos.length > 500) {
      throw new BadRequestException('Batch size cannot exceed 500 events');
    }

    const job = await this.eventsQueue.add('create-events', {
      events: createEventDtos,
    });

    return {
      message: 'Batch processing started',
      jobId: job.id ?? job.name,
    };
  }

  // --- Private Helpers ---

  private isOverlapping(a: Event, b: Event): boolean {
    return a.startTime < b.endTime && b.startTime < a.endTime;
  }

  private buildOverlapClusters(sortedEvents: Event[]): Event[][] {
    if (sortedEvents.length === 0) return [];

    const clusters: Event[][] = [[sortedEvents[0]]];

    for (let i = 1; i < sortedEvents.length; i++) {
      const current = sortedEvents[i];
      const lastCluster = clusters[clusters.length - 1];
      const overlaps = lastCluster.some((e) => this.isOverlapping(e, current));

      if (overlaps) {
        lastCluster.push(current);
      } else {
        clusters.push([current]);
      }
    }

    return clusters;
  }

  private combineEvents(cluster: Event[]): Event {
    // Pick earliest start, latest end
    const startTime = new Date(
      Math.min(...cluster.map((e) => e.startTime.getTime())),
    );
    const endTime = new Date(
      Math.max(...cluster.map((e) => e.endTime.getTime())),
    );

    // Concatenate titles
    const title = cluster.map((e) => e.title).join(' + ');

    // Combine descriptions
    const description = cluster
      .map((e) => e.description)
      .filter(Boolean)
      .join(' | ');

    // Keep the latest (highest priority) status
    const statusPriority: EventStatus[] = [
      EventStatus.CANCELED,
      EventStatus.TODO,
      EventStatus.IN_PROGRESS,
      EventStatus.COMPLETED,
    ];
    const status = cluster.reduce((best, e) => {
      return statusPriority.indexOf(e.status) > statusPriority.indexOf(best)
        ? e.status
        : best;
    }, cluster[0].status);

    // Collect all unique invitees
    const inviteeMap = new Map<string, User>();
    for (const event of cluster) {
      if (event.invitees) {
        for (const user of event.invitees) {
          inviteeMap.set(user.id, user);
        }
      }
    }

    const merged = new Event();
    merged.title = title;
    merged.description = description;
    merged.status = status;
    merged.startTime = startTime;
    merged.endTime = endTime;
    merged.invitees = Array.from(inviteeMap.values());
    merged.mergedFrom = cluster.map((e) => e.id);

    return merged;
  }
}
