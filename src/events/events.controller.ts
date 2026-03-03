import { Controller, Post, Param, Get, Put, Delete, Body } from '@nestjs/common';
import { EventsService } from './events.service';
import { UpdateEventDto } from '../dto/updateEventDto';

@Controller('events')
export class EventsController {
    constructor(private readonly eventsService: EventsService) {}

    @Post('')
    createEvent() {
        this.eventsService.createEvent();
    }

    @Get(':id')
    getEventById(@Param('id') id: number) {
        this.eventsService.getEventById(id);
    }

    @Put(':id')
    updateEvent(@Param('id') id: number, @Body() updateEventDto: UpdateEventDto) {
        this.eventsService.updateEvent(id, updateEventDto);
    }

    @Delete(':id')
    deleteEvent(@Param('id') id: number) {
        this.eventsService.deleteEvent(id);
    }

        /**
     * POST /events/merge-all/:userId


Merge all overlapping events for the user.


Log merge details in AuditLog table (include old IDs, new ID, timestamp).


Combine metadata intelligently (e.g. titles concatenated, latest status kept).

     */

    @Post('/merge-all/:userId')
    mergeAllEvents(@Param('userId') userId: number) {
        // This method will call the service to merge all overlapping events for the user
        console.log(`Merge all overlapping events for user with id: ${userId}`);
        return this.eventsService.mergeAllEvents(userId);
    }

    @Get('/conflicts/:userId')
    conflictEvents(@Param('userId') userId: number) {
        // This method will call the service to get all conflicting events for the user
        console.log(`Get all conflicting events for user with id: ${userId}`);
        return this.eventsService.conflictEvents(userId);
    }

    /**
     * Implement:
POST /events/batch
 Accepts up to 500 events. Must process in under 2 seconds using efficient bulk inserts.


Use transactions to ensure consistency.


Add an optional background worker (BullMQ or equivalent) to offload AI summarization.
     */

    @Post('/batch')
    batchCreateEvents(@Body() events: any[]) {
        // This method will call the service to create events in batch
        console.log(`Batch create events:`, events);
        // Here you would implement the logic to process the batch of events, use transactions, and optionally offload AI summarization
        this.eventsService.batchCreateEvents(events);
    }

}
