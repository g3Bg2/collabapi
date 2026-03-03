import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '../entities/events.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { User } from '../entities/user.entity';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [TypeOrmModule.forFeature([Event, AuditLog, User]), AiModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
