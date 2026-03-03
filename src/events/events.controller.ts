import { Controller, Post, Param, Get, Put, Delete, Body } from '@nestjs/common';
import { EventsService } from './events.service';
import { UpdateEventDto } from '../dto/updateEventDto';

@Controller('events')
export class EventsController {
    constructor(private readonly eventsService: EventsService) {}

    @Post('/events')
    createEvent() {
        this.eventsService.createEvent();
    }

    @Get('/events/:id')
    getEventById(@Param('id') id: number) {
        this.eventsService.getEventById(id);
    }

    @Put('/events/:id')
    updateEvent(@Param('id') id: number, @Body() updateEventDto: UpdateEventDto) {
        this.eventsService.updateEvent(id, updateEventDto);
    }

    @Delete('/events/:id')
    deleteEvent(@Param('id') id: number) {
        this.eventsService.deleteEvent(id);
    }

        /**
     * POST /events/merge-all/:userId


Merge all overlapping events for the user.


Log merge details in AuditLog table (include old IDs, new ID, timestamp).


Combine metadata intelligently (e.g. titles concatenated, latest status kept).

     */

    @Post('/events/merge-all/:userId')
    mergeAllEvents(@Param('userId') userId: number) {
        // This method will call the service to merge all overlapping events for the user
        console.log(`Merge all overlapping events for user with id: ${userId}`);
        return this.eventsService.mergeAllEvents(userId);
    }

    @Get('/events/conflicts/:userId')
    conflictEvents(@Param('userId') userId: number) {
        // This method will call the service to get all conflicting events for the user
        console.log(`Get all conflicting events for user with id: ${userId}`);
        return this.eventsService.conflictEvents(userId);
    }

}
