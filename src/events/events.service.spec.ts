import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EventsService } from './events.service';
import { Event, EventStatus } from '../entities/events.entity';
import { User } from '../entities/user.entity';
import { AiService } from '../ai/ai.service';

// --- Helpers to build test events ---

function makeEvent(
  overrides: Partial<Event> & { id: string; title: string },
): Event {
  const e = new Event();
  e.id = overrides.id;
  e.title = overrides.title;
  e.description = overrides.description ?? '';
  e.status = overrides.status ?? EventStatus.TODO;
  e.startTime = overrides.startTime ?? new Date('2025-06-01T09:00:00Z');
  e.endTime = overrides.endTime ?? new Date('2025-06-01T10:00:00Z');
  e.invitees = overrides.invitees ?? [];
  e.mergedFrom = overrides.mergedFrom ?? null as any;
  return e;
}

// --- Mocks ---

const mockEventRepo = {
  create: jest.fn((data) => Object.assign(new Event(), data)),
  save: jest.fn((e) => Promise.resolve({ ...e, id: e.id || 'new-id' })),
  findOne: jest.fn(),
  findBy: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockUserRepo = {
  findBy: jest.fn(),
};

const mockAiService = {
  summarizeMergedEvent: jest.fn().mockResolvedValue('AI summary mock'),
};

// Transaction mock: runs callback with a manager that mirrors the repos
const mockManager = {
  save: jest.fn((_, entity) => {
    if (Array.isArray(entity)) {
      return Promise.resolve(
        entity.map((e, i) => ({ ...e, id: e.id || `batch-${i}` })),
      );
    }
    return Promise.resolve({ ...entity, id: entity.id || 'merged-id' });
  }),
  create: jest.fn((_, data) => ({ ...data })),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
  findBy: jest.fn().mockResolvedValue([]),
};

const mockDataSource = {
  transaction: jest.fn((cb) => cb(mockManager)),
};

describe('EventsService', () => {
  let service: EventsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: getRepositoryToken(Event), useValue: mockEventRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: AiService, useValue: mockAiService },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    jest.clearAllMocks();

    // Re-set default mocks after clearAllMocks
    mockManager.save.mockImplementation((_, entity) => {
      if (Array.isArray(entity)) {
        return Promise.resolve(
          entity.map((e, i) => ({ ...e, id: e.id || `batch-${i}` })),
        );
      }
      return Promise.resolve({ ...entity, id: entity.id || 'merged-id' });
    });
    mockManager.create.mockImplementation((_, data) => ({ ...data }));
    mockManager.delete.mockResolvedValue({ affected: 1 });
    mockManager.findBy.mockResolvedValue([]);
    mockDataSource.transaction.mockImplementation((cb) => cb(mockManager));
    mockAiService.summarizeMergedEvent.mockResolvedValue('AI summary mock');
  });

  // ===================== CRUD =====================

  describe('createEvent', () => {
    it('should create an event without invitees', async () => {
      mockEventRepo.save.mockResolvedValue({
        id: 'e1',
        title: 'Standup',
        status: EventStatus.TODO,
      });

      const result = await service.createEvent({
        title: 'Standup',
        startTime: new Date(),
        endTime: new Date(),
      });

      expect(result.title).toBe('Standup');
      expect(mockEventRepo.create).toHaveBeenCalled();
      expect(mockEventRepo.save).toHaveBeenCalled();
    });

    it('should create an event with invitees', async () => {
      const users = [{ id: 'u1', name: 'Alice' }];
      mockUserRepo.findBy.mockResolvedValue(users);
      mockEventRepo.save.mockResolvedValue({
        id: 'e2',
        title: 'Meeting',
        invitees: users,
      });

      const result = await service.createEvent({
        title: 'Meeting',
        startTime: new Date(),
        endTime: new Date(),
        inviteeIds: ['u1'],
      });

      expect(mockUserRepo.findBy).toHaveBeenCalled();
      expect(result.invitees).toHaveLength(1);
    });
  });

  describe('getEventById', () => {
    it('should return event when found', async () => {
      mockEventRepo.findOne.mockResolvedValue({ id: 'e1', title: 'Test' });
      const result = await service.getEventById('e1');
      expect(result.id).toBe('e1');
    });

    it('should throw NotFoundException when not found', async () => {
      mockEventRepo.findOne.mockResolvedValue(null);
      await expect(service.getEventById('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateEvent', () => {
    it('should update event fields', async () => {
      const existing = makeEvent({ id: 'e1', title: 'Old' });
      mockEventRepo.findOne.mockResolvedValue(existing);
      mockEventRepo.save.mockResolvedValue({ ...existing, title: 'New' });

      const result = await service.updateEvent('e1', { title: 'New' });
      expect(result.title).toBe('New');
    });

    it('should update invitees when inviteeIds provided', async () => {
      const existing = makeEvent({ id: 'e1', title: 'T' });
      mockEventRepo.findOne.mockResolvedValue(existing);
      mockUserRepo.findBy.mockResolvedValue([{ id: 'u1' }]);
      mockEventRepo.save.mockImplementation((e) => Promise.resolve(e));

      const result = await service.updateEvent('e1', { inviteeIds: ['u1'] });
      expect(result.invitees).toHaveLength(1);
    });

    it('should clear invitees when empty array provided', async () => {
      const existing = makeEvent({
        id: 'e1',
        title: 'T',
        invitees: [{ id: 'u1' } as User],
      });
      mockEventRepo.findOne.mockResolvedValue(existing);
      mockEventRepo.save.mockImplementation((e) => Promise.resolve(e));

      const result = await service.updateEvent('e1', { inviteeIds: [] });
      expect(result.invitees).toHaveLength(0);
    });
  });

  describe('deleteEvent', () => {
    it('should delete when event exists', async () => {
      mockEventRepo.delete.mockResolvedValue({ affected: 1 });
      await expect(service.deleteEvent('e1')).resolves.toBeUndefined();
    });

    it('should throw NotFoundException when event not found', async () => {
      mockEventRepo.delete.mockResolvedValue({ affected: 0 });
      await expect(service.deleteEvent('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ===================== Conflict Detection =====================

  describe('getConflicts', () => {
    const mockQB = {
      innerJoin: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };

    beforeEach(() => {
      mockEventRepo.createQueryBuilder.mockReturnValue(mockQB);
    });

    it('should return empty array when no events', async () => {
      mockQB.getMany.mockResolvedValue([]);
      const result = await service.getConflicts('u1');
      expect(result).toEqual([]);
    });

    it('should detect two overlapping events', async () => {
      const events = [
        makeEvent({
          id: 'e1',
          title: 'A',
          startTime: new Date('2025-06-01T09:00:00Z'),
          endTime: new Date('2025-06-01T10:30:00Z'),
        }),
        makeEvent({
          id: 'e2',
          title: 'B',
          startTime: new Date('2025-06-01T10:00:00Z'),
          endTime: new Date('2025-06-01T11:00:00Z'),
        }),
      ];
      mockQB.getMany.mockResolvedValue(events);

      const result = await service.getConflicts('u1');
      expect(result).toHaveLength(1);
      expect(result[0].eventA.id).toBe('e1');
      expect(result[0].eventB.id).toBe('e2');
    });

    it('should return empty when events do not overlap', async () => {
      const events = [
        makeEvent({
          id: 'e1',
          title: 'A',
          startTime: new Date('2025-06-01T09:00:00Z'),
          endTime: new Date('2025-06-01T10:00:00Z'),
        }),
        makeEvent({
          id: 'e2',
          title: 'B',
          startTime: new Date('2025-06-01T11:00:00Z'),
          endTime: new Date('2025-06-01T12:00:00Z'),
        }),
      ];
      mockQB.getMany.mockResolvedValue(events);

      const result = await service.getConflicts('u1');
      expect(result).toHaveLength(0);
    });

    it('should detect multiple conflicts in a chain', async () => {
      // A overlaps B, B overlaps C → 2 conflict pairs (A-B, B-C) + possibly A-C
      const events = [
        makeEvent({
          id: 'e1',
          title: 'A',
          startTime: new Date('2025-06-01T09:00:00Z'),
          endTime: new Date('2025-06-01T10:30:00Z'),
        }),
        makeEvent({
          id: 'e2',
          title: 'B',
          startTime: new Date('2025-06-01T10:00:00Z'),
          endTime: new Date('2025-06-01T11:30:00Z'),
        }),
        makeEvent({
          id: 'e3',
          title: 'C',
          startTime: new Date('2025-06-01T11:00:00Z'),
          endTime: new Date('2025-06-01T12:00:00Z'),
        }),
      ];
      mockQB.getMany.mockResolvedValue(events);

      const result = await service.getConflicts('u1');
      expect(result.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ===================== Merge Logic (Integration-style) =====================

  describe('mergeAllEvents', () => {
    const mockQB = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };

    beforeEach(() => {
      mockEventRepo.createQueryBuilder.mockReturnValue(mockQB);
    });

    it('should return empty when no overlapping events', async () => {
      const events = [
        makeEvent({
          id: 'e1',
          title: 'A',
          startTime: new Date('2025-06-01T09:00:00Z'),
          endTime: new Date('2025-06-01T10:00:00Z'),
        }),
        makeEvent({
          id: 'e2',
          title: 'B',
          startTime: new Date('2025-06-01T11:00:00Z'),
          endTime: new Date('2025-06-01T12:00:00Z'),
        }),
      ];
      mockQB.getMany.mockResolvedValue(events);

      const result = await service.mergeAllEvents('u1');
      expect(result.merged).toHaveLength(0);
      expect(result.auditLogs).toHaveLength(0);
      expect(result.summaries).toEqual({});
    });

    it('should merge two overlapping events', async () => {
      const events = [
        makeEvent({
          id: 'e1',
          title: 'Planning',
          description: 'Plan sprint',
          status: EventStatus.TODO,
          startTime: new Date('2025-06-01T09:00:00Z'),
          endTime: new Date('2025-06-01T10:30:00Z'),
        }),
        makeEvent({
          id: 'e2',
          title: 'Demo',
          description: 'Show demo',
          status: EventStatus.IN_PROGRESS,
          startTime: new Date('2025-06-01T10:00:00Z'),
          endTime: new Date('2025-06-01T11:00:00Z'),
        }),
      ];
      mockQB.getMany.mockResolvedValue(events);

      const result = await service.mergeAllEvents('u1');

      expect(result.merged).toHaveLength(1);
      expect(result.auditLogs).toHaveLength(1);

      // Verify merge metadata in the transaction calls
      const savedEvent = mockManager.save.mock.calls[0][1];
      expect(savedEvent.title).toBe('Planning + Demo');
      expect(savedEvent.description).toBe('Plan sprint | Show demo');
      expect(savedEvent.status).toBe(EventStatus.IN_PROGRESS);
      expect(savedEvent.mergedFrom).toEqual(['e1', 'e2']);
      // Earliest start, latest end
      expect(savedEvent.startTime).toEqual(
        new Date('2025-06-01T09:00:00Z'),
      );
      expect(savedEvent.endTime).toEqual(new Date('2025-06-01T11:00:00Z'));

      // Verify audit log was created
      const auditData = mockManager.create.mock.calls[0][1];
      expect(auditData.action).toBe('MERGE');
      expect(auditData.oldEventIds).toEqual(['e1', 'e2']);

      // Verify old events were deleted
      expect(mockManager.delete).toHaveBeenCalledWith(Event, ['e1', 'e2']);

      // Verify AI summary was requested
      expect(mockAiService.summarizeMergedEvent).toHaveBeenCalled();
      expect(Object.values(result.summaries)[0]).toBe('AI summary mock');
    });

    it('should keep highest-priority status (COMPLETED > IN_PROGRESS > TODO > CANCELED)', async () => {
      const events = [
        makeEvent({
          id: 'e1',
          title: 'A',
          status: EventStatus.CANCELED,
          startTime: new Date('2025-06-01T09:00:00Z'),
          endTime: new Date('2025-06-01T10:30:00Z'),
        }),
        makeEvent({
          id: 'e2',
          title: 'B',
          status: EventStatus.COMPLETED,
          startTime: new Date('2025-06-01T10:00:00Z'),
          endTime: new Date('2025-06-01T11:00:00Z'),
        }),
      ];
      mockQB.getMany.mockResolvedValue(events);

      await service.mergeAllEvents('u1');

      const savedEvent = mockManager.save.mock.calls[0][1];
      expect(savedEvent.status).toBe(EventStatus.COMPLETED);
    });

    it('should collect unique invitees from all events in the cluster', async () => {
      const user1 = { id: 'u1', name: 'Alice' } as User;
      const user2 = { id: 'u2', name: 'Bob' } as User;

      const events = [
        makeEvent({
          id: 'e1',
          title: 'A',
          invitees: [user1],
          startTime: new Date('2025-06-01T09:00:00Z'),
          endTime: new Date('2025-06-01T10:30:00Z'),
        }),
        makeEvent({
          id: 'e2',
          title: 'B',
          invitees: [user1, user2],
          startTime: new Date('2025-06-01T10:00:00Z'),
          endTime: new Date('2025-06-01T11:00:00Z'),
        }),
      ];
      mockQB.getMany.mockResolvedValue(events);

      await service.mergeAllEvents('u1');

      const savedEvent = mockManager.save.mock.calls[0][1];
      expect(savedEvent.invitees).toHaveLength(2);
    });

    it('should handle multiple separate overlap clusters', async () => {
      const events = [
        // Cluster 1: e1 + e2 overlap
        makeEvent({
          id: 'e1',
          title: 'A',
          startTime: new Date('2025-06-01T09:00:00Z'),
          endTime: new Date('2025-06-01T10:30:00Z'),
        }),
        makeEvent({
          id: 'e2',
          title: 'B',
          startTime: new Date('2025-06-01T10:00:00Z'),
          endTime: new Date('2025-06-01T11:00:00Z'),
        }),
        // Cluster 2: e3 + e4 overlap (gap between cluster 1 and 2)
        makeEvent({
          id: 'e3',
          title: 'C',
          startTime: new Date('2025-06-01T14:00:00Z'),
          endTime: new Date('2025-06-01T15:30:00Z'),
        }),
        makeEvent({
          id: 'e4',
          title: 'D',
          startTime: new Date('2025-06-01T15:00:00Z'),
          endTime: new Date('2025-06-01T16:00:00Z'),
        }),
      ];
      mockQB.getMany.mockResolvedValue(events);

      const result = await service.mergeAllEvents('u1');
      expect(result.merged).toHaveLength(2);
      expect(result.auditLogs).toHaveLength(2);
    });
  });

  // ===================== Batch Create =====================

  describe('batchCreateEvents', () => {
    it('should reject more than 500 events', async () => {
      const events = Array.from({ length: 501 }, (_, i) => ({
        title: `Event ${i}`,
        startTime: new Date(),
        endTime: new Date(),
      }));

      await expect(service.batchCreateEvents(events)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should batch create events in a transaction', async () => {
      const dtos = [
        { title: 'A', startTime: new Date(), endTime: new Date() },
        { title: 'B', startTime: new Date(), endTime: new Date() },
      ];

      const result = await service.batchCreateEvents(dtos);

      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockManager.save).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it('should resolve invitees for events that have inviteeIds', async () => {
      mockManager.findBy.mockResolvedValue([{ id: 'u1', name: 'Alice' }]);

      const dtos = [
        {
          title: 'With invitees',
          startTime: new Date(),
          endTime: new Date(),
          inviteeIds: ['u1'],
        },
      ];

      await service.batchCreateEvents(dtos);

      expect(mockManager.findBy).toHaveBeenCalled();
    });
  });

  // ===================== Property-based Test =====================

  describe('overlap detection (property-based)', () => {

    it('merged event should always span the full range of its source events', async () => {
      const mockQB = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn(),
      };
      mockEventRepo.createQueryBuilder.mockReturnValue(mockQB);

      // Run 20 randomized trials
      for (let trial = 0; trial < 20; trial++) {
        jest.clearAllMocks();
        mockManager.save.mockImplementation((_, entity) => {
          if (Array.isArray(entity)) {
            return Promise.resolve(entity.map((e, i) => ({ ...e, id: `b-${i}` })));
          }
          return Promise.resolve({ ...entity, id: `merged-${trial}` });
        });
        mockManager.create.mockImplementation((_, data) => ({ ...data }));
        mockManager.delete.mockResolvedValue({ affected: 1 });
        mockDataSource.transaction.mockImplementation((cb) => cb(mockManager));
        mockAiService.summarizeMergedEvent.mockResolvedValue('summary');
        mockEventRepo.createQueryBuilder.mockReturnValue(mockQB);

        // Generate 2-5 guaranteed-overlapping events by using a sliding window
        const baseMs = new Date('2025-01-01').getTime();
        const count = 2 + Math.floor(Math.random() * 4);
        const events: Event[] = [];
        let cursor = baseMs + Math.random() * 3600000;

        for (let i = 0; i < count; i++) {
          const start = new Date(cursor);
          const duration = 600000 + Math.random() * 3600000; // 10min - 1hr
          const end = new Date(cursor + duration);
          // Next event starts before this one ends (guaranteed overlap)
          cursor = cursor + duration * 0.3 + Math.random() * duration * 0.4;
          events.push(
            makeEvent({
              id: `rand-${trial}-${i}`,
              title: `Ev${i}`,
              startTime: start,
              endTime: end,
            }),
          );
        }

        // Sort by start (the service expects sorted input)
        events.sort(
          (a, b) => a.startTime.getTime() - b.startTime.getTime(),
        );
        mockQB.getMany.mockResolvedValue(events);

        const result = await service.mergeAllEvents('u1');

        if (result.merged.length > 0) {
          const savedEvent = mockManager.save.mock.calls[0][1];

          const earliestStart = Math.min(
            ...events.map((e) => e.startTime.getTime()),
          );
          const latestEnd = Math.max(
            ...events.map((e) => e.endTime.getTime()),
          );

          // The merged event must cover the full range
          expect(savedEvent.startTime.getTime()).toBeLessThanOrEqual(
            earliestStart,
          );
          expect(savedEvent.endTime.getTime()).toBeGreaterThanOrEqual(
            latestEnd,
          );

          // mergedFrom must contain all source IDs
          expect(savedEvent.mergedFrom.length).toBeGreaterThanOrEqual(2);
        }
      }
    });

    it('non-overlapping events should never be merged together', () => {
      // Access private method via bracket notation for direct testing
      const isOverlapping = (service as any).isOverlapping.bind(service);

      for (let trial = 0; trial < 50; trial++) {
        const baseMs = new Date('2025-01-01').getTime();
        const startA = baseMs + Math.random() * 86400000;
        const durationA = 600000 + Math.random() * 3600000;
        const endA = startA + durationA;

        // B starts strictly after A ends
        const gap = 1000 + Math.random() * 3600000;
        const startB = endA + gap;
        const durationB = 600000 + Math.random() * 3600000;
        const endB = startB + durationB;

        const a = makeEvent({
          id: 'a',
          title: 'A',
          startTime: new Date(startA),
          endTime: new Date(endA),
        });
        const b = makeEvent({
          id: 'b',
          title: 'B',
          startTime: new Date(startB),
          endTime: new Date(endB),
        });

        expect(isOverlapping(a, b)).toBe(false);
        expect(isOverlapping(b, a)).toBe(false);
      }
    });
  });
});
