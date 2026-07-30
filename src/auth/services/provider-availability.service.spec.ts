import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProviderAvailabilityService } from './provider-availability.service';
import { ProviderAvailability } from '../entities/provider-availability.entity';
import { User, UserRole } from '../entities/user.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('ProviderAvailabilityService', () => {
    let service: ProviderAvailabilityService;
    let availabilityRepository: Repository<ProviderAvailability>;
    let usersRepository: Repository<User>;

    const mockProvider: User = {
        id: 'provider-1',
        email: 'provider@test.com',
        firstName: 'John',
        lastName: 'Doe',
        displayName: 'Dr. John Doe',
        role: UserRole.PHYSICIAN,
        isActive: true,
        isLicenseVerified: true,
        isAcceptingPatients: true,
        specialization: 'Cardiology',
        specialty: 'Cardiology',
        institution: 'General Hospital',
        country: 'US',
        passwordHash: 'hash',
        mfaEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        mfaSecret: null,
        lastPasswordChangeAt: null,
        failedLoginAttempts: 0,
        lastLoginAt: null,
        lockedUntil: null,
        requiresPasswordChange: false,
        licenseNumber: 'LIC123',
        npi: 'NPI123',
        emergencyAccessEnabled: true,
        stellarPublicKey: 'GKEY123',
        search_vector: null,
        permissions: [],
        mfaDevices: [],
        sessions: [],
        auditLogs: [],
    };

    const mockAvailability: ProviderAvailability = {
        id: 'avail-1',
        providerId: 'provider-1',
        provider: mockProvider,
        isAcceptingPatients: true,
        maxPatients: 50,
        currentPatients: 10,
        specializations: ['Cardiology', 'Internal Medicine'],
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ProviderAvailabilityService,
                {
                    provide: getRepositoryToken(ProviderAvailability),
                    useValue: {
                        findOne: jest.fn(),
                        create: jest.fn(),
                        save: jest.fn(),
                        createQueryBuilder: jest.fn(),
                    },
                },
                {
                    provide: getRepositoryToken(User),
                    useValue: {
                        findOne: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<ProviderAvailabilityService>(ProviderAvailabilityService);
        availabilityRepository = module.get<Repository<ProviderAvailability>>(
            getRepositoryToken(ProviderAvailability),
        );
        usersRepository = module.get<Repository<User>>(getRepositoryToken(User));
    });

    describe('getOrCreateAvailability', () => {
        it('should return existing availability', async () => {
            jest.spyOn(availabilityRepository, 'findOne').mockResolvedValue(mockAvailability);

            const result = await service.getOrCreateAvailability('provider-1');

            expect(result).toEqual(mockAvailability);
            expect(availabilityRepository.findOne).toHaveBeenCalledWith({
                where: { providerId: 'provider-1' },
            });
        });

        it('should create new availability if not exists', async () => {
            jest.spyOn(availabilityRepository, 'findOne').mockResolvedValue(null);
            jest.spyOn(usersRepository, 'findOne').mockResolvedValue(mockProvider);
            jest.spyOn(availabilityRepository, 'create').mockReturnValue(mockAvailability);
            jest.spyOn(availabilityRepository, 'save').mockResolvedValue(mockAvailability);

            const result = await service.getOrCreateAvailability('provider-1');

            expect(result).toEqual(mockAvailability);
            expect(availabilityRepository.create).toHaveBeenCalled();
            expect(availabilityRepository.save).toHaveBeenCalled();
        });

        it('should throw NotFoundException if provider not found', async () => {
            jest.spyOn(availabilityRepository, 'findOne').mockResolvedValue(null);
            jest.spyOn(usersRepository, 'findOne').mockResolvedValue(null);

            await expect(service.getOrCreateAvailability('invalid-id')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('updateAvailability', () => {
        it('should update availability status', async () => {
            jest.spyOn(service, 'getOrCreateAvailability').mockResolvedValue(mockAvailability);
            jest.spyOn(availabilityRepository, 'save').mockResolvedValue({
                ...mockAvailability,
                isAcceptingPatients: false,
            });

            const result = await service.updateAvailability('provider-1', {
                isAcceptingPatients: false,
            });

            expect(result.isAcceptingPatients).toBe(false);
            expect(availabilityRepository.save).toHaveBeenCalled();
        });

        it('should update max patients', async () => {
            jest.spyOn(service, 'getOrCreateAvailability').mockResolvedValue(mockAvailability);
            jest.spyOn(availabilityRepository, 'save').mockResolvedValue({
                ...mockAvailability,
                maxPatients: 100,
            });

            const result = await service.updateAvailability('provider-1', {
                maxPatients: 100,
            });

            expect(result.maxPatients).toBe(100);
        });

        it('should throw error if maxPatients < currentPatients', async () => {
            jest.spyOn(service, 'getOrCreateAvailability').mockResolvedValue(mockAvailability);

            await expect(
                service.updateAvailability('provider-1', {
                    maxPatients: 5,
                }),
            ).rejects.toThrow(BadRequestException);
        });

        it('should update specializations', async () => {
            jest.spyOn(service, 'getOrCreateAvailability').mockResolvedValue(mockAvailability);
            jest.spyOn(availabilityRepository, 'save').mockResolvedValue({
                ...mockAvailability,
                specializations: ['Neurology'],
            });

            const result = await service.updateAvailability('provider-1', {
                specializations: ['Neurology'],
            });

            expect(result.specializations).toEqual(['Neurology']);
        });
    });

    describe('getAvailability', () => {
        it('should return provider availability', async () => {
            jest.spyOn(service, 'getOrCreateAvailability').mockResolvedValue(mockAvailability);

            const result = await service.getAvailability('provider-1');

            expect(result.providerId).toBe('provider-1');
            expect(result.isAcceptingPatients).toBe(true);
            expect(result.maxPatients).toBe(50);
        });
    });

    describe('incrementCurrentPatients', () => {
        it('should increment current patients', async () => {
            jest.spyOn(service, 'getOrCreateAvailability').mockResolvedValue(mockAvailability);
            jest.spyOn(availabilityRepository, 'save').mockResolvedValue({
                ...mockAvailability,
                currentPatients: 11,
            });

            await service.incrementCurrentPatients('provider-1', 1);

            expect(availabilityRepository.save).toHaveBeenCalled();
        });

        it('should throw error if exceeding max capacity', async () => {
            const fullAvailability = { ...mockAvailability, currentPatients: 50 };
            jest.spyOn(service, 'getOrCreateAvailability').mockResolvedValue(fullAvailability);

            await expect(service.incrementCurrentPatients('provider-1', 1)).rejects.toThrow(
                BadRequestException,
            );
        });

        it('should allow increment if no max limit set', async () => {
            const noLimitAvailability = { ...mockAvailability, maxPatients: 0 };
            jest.spyOn(service, 'getOrCreateAvailability').mockResolvedValue(noLimitAvailability);
            jest.spyOn(availabilityRepository, 'save').mockResolvedValue(noLimitAvailability);

            await service.incrementCurrentPatients('provider-1', 100);

            expect(availabilityRepository.save).toHaveBeenCalled();
        });
    });

    describe('decrementCurrentPatients', () => {
        it('should decrement current patients', async () => {
            jest.spyOn(service, 'getOrCreateAvailability').mockResolvedValue(mockAvailability);
            jest.spyOn(availabilityRepository, 'save').mockResolvedValue({
                ...mockAvailability,
                currentPatients: 9,
            });

            await service.decrementCurrentPatients('provider-1', 1);

            expect(availabilityRepository.save).toHaveBeenCalled();
        });

        it('should not go below zero', async () => {
            const lowAvailability = { ...mockAvailability, currentPatients: 0 };
            jest.spyOn(service, 'getOrCreateAvailability').mockResolvedValue(lowAvailability);
            jest.spyOn(availabilityRepository, 'save').mockResolvedValue(lowAvailability);

            await service.decrementCurrentPatients('provider-1', 5);

            expect(availabilityRepository.save).toHaveBeenCalled();
        });
    });

    describe('getAvailableProviders', () => {
        it('should return list of available providers', async () => {
            const mockQueryBuilder = {
                createQueryBuilder: jest.fn().mockReturnThis(),
                innerJoinAndSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([mockAvailability]),
            };

            jest
                .spyOn(availabilityRepository, 'createQueryBuilder')
                .mockReturnValue(mockQueryBuilder as any);

            const result = await service.getAvailableProviders();

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
        });

        it('should filter by specialization', async () => {
            const mockQueryBuilder = {
                createQueryBuilder: jest.fn().mockReturnThis(),
                innerJoinAndSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([mockAvailability]),
            };

            jest
                .spyOn(availabilityRepository, 'createQueryBuilder')
                .mockReturnValue(mockQueryBuilder as any);

            const result = await service.getAvailableProviders('Cardiology');

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                expect.stringContaining('specializations'),
                expect.any(Object),
            );
        });
    });

    describe('canAcceptPatient', () => {
        it('should return true if provider can accept patients', async () => {
            jest.spyOn(service, 'getOrCreateAvailability').mockResolvedValue(mockAvailability);

            const result = await service.canAcceptPatient('provider-1');

            expect(result).toBe(true);
        });

        it('should return false if not accepting patients', async () => {
            const notAcceptingAvailability = { ...mockAvailability, isAcceptingPatients: false };
            jest.spyOn(service, 'getOrCreateAvailability').mockResolvedValue(notAcceptingAvailability);

            const result = await service.canAcceptPatient('provider-1');

            expect(result).toBe(false);
        });

        it('should return false if at max capacity', async () => {
            const fullAvailability = { ...mockAvailability, currentPatients: 50, maxPatients: 50 };
            jest.spyOn(service, 'getOrCreateAvailability').mockResolvedValue(fullAvailability);

            const result = await service.canAcceptPatient('provider-1');

            expect(result).toBe(false);
        });
    });
});
