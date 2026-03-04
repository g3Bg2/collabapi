import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { DataSource, In } from 'typeorm';
import { Event } from '../entities/events.entity';
import { User } from '../entities/user.entity';

@Processor('bulk-events')
export class EventsProcessor extends WorkerHost {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async process(job: Job<any>) {
    if (job.name === 'create-events') {
      const createEventDtos = job.data.events;

      console.log('Processing batch:', createEventDtos.length);

      return this.dataSource.transaction(async (manager) => {
        const events: Event[] = [];

        for (const dto of createEventDtos) {
          const { inviteeIds, ...eventData } = dto;
          const event = manager.create(Event, eventData);

          if (inviteeIds?.length) {
            event.invitees = await manager.findBy(User, {
              id: In(inviteeIds),
            });
          }

          events.push(event);
        }

        return manager.save(Event, events);
      });
    }
  }
}
