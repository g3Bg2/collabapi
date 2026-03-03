import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity()
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  action: string;

  @Column({ type: 'json' })
  oldEventIds: string[];

  @Column()
  newEventId: string;

  @Column()
  userId: string;

  @Column({ type: 'json', nullable: true })
  details: Record<string, any>;

  @CreateDateColumn()
  timestamp: Date;
}
