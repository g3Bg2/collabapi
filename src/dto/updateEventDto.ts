export class UpdateEventDto {
    title?: string;
    description?: string;
    date?: Date;
    invitees?: number[]; // array of user ids
}