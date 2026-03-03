import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from '../dto/createUserDto';
import { UpdateUserDto } from '../dto/updateUserDto';


@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Get()
    getAllUsers() {
        this.userService.getAllUsers();
    }

    @Get(':id')
    getUserById(@Param('id') id: number) {
        this.userService.getUserById(id);
    }

    @Post('')
    createUser(@Body() createUserDto: CreateUserDto) {
        this.userService.createUser(createUserDto);
    }

    @Put(':id')
    updateUser(@Param('id') id: number, @Body() updateUserDto: UpdateUserDto) {
        this.userService.updateUser(id, updateUserDto);
    }

    @Delete(':id')
    deleteUser(@Param('id') id: number) {
        this.userService.deleteUser(id);
    }
}
