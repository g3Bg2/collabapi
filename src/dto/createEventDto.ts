import { EventStatus } from '../entities/events.entity';

export class CreateEventDto {
  title: string;
  description?: string;
  status?: EventStatus;
  startTime: Date;
  endTime: Date;
  inviteeIds?: string[];
}
