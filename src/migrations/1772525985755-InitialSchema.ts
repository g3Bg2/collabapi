import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1772525985755 implements MigrationInterface {
  name = 'InitialSchema1772525985755';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`user\` (
        \`id\` varchar(36) NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`email\` varchar(255) NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_e12875dfb3b1d92d7d7c5377e2\` (\`email\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `CREATE TABLE \`event\` (
        \`id\` varchar(36) NOT NULL,
        \`title\` varchar(255) NOT NULL,
        \`description\` varchar(255) NULL,
        \`status\` enum('TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELED') NOT NULL DEFAULT 'TODO',
        \`startTime\` datetime NOT NULL,
        \`endTime\` datetime NOT NULL,
        \`mergedFrom\` json NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `CREATE TABLE \`event_invitees_user\` (
        \`eventId\` varchar(36) NOT NULL,
        \`userId\` varchar(36) NOT NULL,
        INDEX \`IDX_event_invitees_eventId\` (\`eventId\`),
        INDEX \`IDX_event_invitees_userId\` (\`userId\`),
        PRIMARY KEY (\`eventId\`, \`userId\`)
      ) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `CREATE TABLE \`audit_log\` (
        \`id\` varchar(36) NOT NULL,
        \`action\` varchar(255) NOT NULL,
        \`oldEventIds\` json NOT NULL,
        \`newEventId\` varchar(255) NOT NULL,
        \`userId\` varchar(255) NOT NULL,
        \`details\` json NULL,
        \`timestamp\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `ALTER TABLE \`event_invitees_user\`
        ADD CONSTRAINT \`FK_event_invitees_eventId\`
        FOREIGN KEY (\`eventId\`) REFERENCES \`event\`(\`id\`)
        ON DELETE CASCADE ON UPDATE CASCADE`,
    );

    await queryRunner.query(
      `ALTER TABLE \`event_invitees_user\`
        ADD CONSTRAINT \`FK_event_invitees_userId\`
        FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`)
        ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`event_invitees_user\` DROP FOREIGN KEY \`FK_event_invitees_userId\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`event_invitees_user\` DROP FOREIGN KEY \`FK_event_invitees_eventId\``,
    );
    await queryRunner.query(`DROP TABLE \`audit_log\``);
    await queryRunner.query(`DROP TABLE \`event_invitees_user\``);
    await queryRunner.query(`DROP TABLE \`event\``);
    await queryRunner.query(`DROP TABLE \`user\``);
  }
}
