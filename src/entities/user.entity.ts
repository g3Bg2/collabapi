import { Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Event } from "./events.entity";


@Entity()
export class User {
    @PrimaryGeneratedColumn()
    id: number;
    
    name: string;
    email: string;

    @OneToMany(() => Event, event => event.invitees)
    events: Event[];
}