import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from '../entities/user.entity';

const mockUser: User = {
  id: 'u1',
  name: 'Alice',
  email: 'alice@test.com',
  events: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
};

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: mockRepository },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    jest.clearAllMocks();
  });

  describe('getAllUsers', () => {
    it('should return an array of users', async () => {
      mockRepository.find.mockResolvedValue([mockUser]);
      const result = await service.getAllUsers();
      expect(result).toEqual([mockUser]);
      expect(mockRepository.find).toHaveBeenCalledWith({
        relations: ['events'],
      });
    });
  });

  describe('getUserById', () => {
    it('should return a user when found', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);
      const result = await service.getUserById('u1');
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(service.getUserById('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createUser', () => {
    it('should create and return a new user', async () => {
      const dto = { name: 'Bob', email: 'bob@test.com' };
      mockRepository.create.mockReturnValue({ ...mockUser, ...dto });
      mockRepository.save.mockResolvedValue({ ...mockUser, ...dto, id: 'u2' });

      const result = await service.createUser(dto);
      expect(result.name).toBe('Bob');
      expect(mockRepository.create).toHaveBeenCalledWith(dto);
      expect(mockRepository.save).toHaveBeenCalled();
    });
  });

  describe('updateUser', () => {
    it('should update and return the user', async () => {
      mockRepository.findOne.mockResolvedValue({ ...mockUser });
      mockRepository.save.mockResolvedValue({ ...mockUser, name: 'Updated' });

      const result = await service.updateUser('u1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    it('should throw NotFoundException for non-existent user', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(
        service.updateUser('missing', { name: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteUser', () => {
    it('should delete successfully when user exists', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 1 });
      await expect(service.deleteUser('u1')).resolves.toBeUndefined();
    });

    it('should throw NotFoundException when user not found', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 0 });
      await expect(service.deleteUser('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
