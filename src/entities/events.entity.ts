import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { User } from "./user.entity";

@Entity()
export class Event {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    title: string;
    description?: string;
    status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';
    startTime: Date;
    endTime: Date;
    invitees: User[];
    mergedFrom?: Event[];
}