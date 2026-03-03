import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Event } from './entities/events.entity';
import { ConfigModule } from '@nestjs/config';
import { EventsModule } from './events/events.module';
import { EventsController } from './events/events.controller';
import { EventsService } from './events/events.service';
import { UserModule } from './user/user.module';
import { UserService } from './user/user.service';
import { UserController } from './user/user.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306', 10),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [User, Event],
      synchronize: true,
    }),
    EventsModule,
    UserModule,
  ],
  controllers: [AppController, EventsController, UserController],
  providers: [AppService, EventsService, UserService],
})
export class AppModule {}
