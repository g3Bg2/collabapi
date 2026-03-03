import { Injectable } from '@nestjs/common';

@Injectable()
export class EventsService {
    createEvent() {
        console.log('Event created!');
    }

    getEventById(id: number) {
        console.log(`Get event with id: ${id}`);
    }

    updateEvent(id: number, updateEventDto: any) {
        console.log(`Update event with id: ${id}`, updateEventDto);
    }

    deleteEvent(id: number) {
        console.log(`Delete event with id: ${id}`);
    }

    /**
     * POST /events/merge-all/:userId


Merge all overlapping events for the user.


Log merge details in AuditLog table (include old IDs, new ID, timestamp).


Combine metadata intelligently (e.g. titles concatenated, latest status kept).

     */
    mergeAllEvents(userId: number) {
        console.log(`Merging all overlapping events for user with id: ${userId}`);
        // Here you would implement the logic to merge events, log details, and combine metadata
    }


    conflictEvents(userId: number) {
        console.log(`Get all conflicting events for user with id: ${userId}`);
    }
}
