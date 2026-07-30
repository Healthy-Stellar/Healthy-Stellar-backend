import { Test, TestingModule } from '@nestjs/testing';
import { ProvidersController } from './providers.controller';
import { ProviderDirectoryService } from '../services/provider-directory.service';
import { ProviderAvailabilityService } from '../services/provider-availability.service';
import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../entities/user.entity';

describe('ProvidersController', () => {
    let controller: ProvidersController;
    let directoryService: ProviderDirectoryService;
    let availabilityService: ProviderAvailabilityService;

    const mockRequest = {
        user: {
            id: 'provider-1',
            email: 'provider@test.com',
            role: UserRole.PHYSICIAN,
        },
    };

    const mockAvailabilityResponse = {
        id: 'avail-1',
        providerId: 'provider-1',
        isAcceptingPatients: true,
        maxPatients: 50,
        currentPatients: 10,
        specializations: ['Cardiology'],
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockAvailableProviders = [
        {
            id: 'provider-1',
            displayName: 'Dr. John Doe',
            specialty: 'Cardiology',
            institution: 'General Hospital',
            isAcceptingPatients: true,
            maxPatients: 50,
            currentPatients: 10,
            specializations: ['Cardiology'],
            availableSlots: 40,
        },
    ];

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [ProvidersController],
            providers: [
                {
                    provide: ProviderDirectoryService,
                    useValue: {
                        searchProviders: jest.fn(),
                    },
                },
                {
                    provide: ProviderAvailabilityService,
                    useValue: {
                        getAvailability: jest.fn(),
                        updateAvailability: jest.fn(),
                        getAvailableProviders: jest.fn(),
                    },
                },
            ],
        }).compile();

        controller = module.get<ProvidersController>(ProvidersController);
        directoryService = module.get<ProviderDirectoryService>(ProviderDirectoryService);
        availabilityService = module.get<ProviderAvailabilityService>(ProviderAvailabilityService);
    });

    describe('findProviders', () => {
        it('should return paginated providers', async () => {
            const mockResult = {
                data: [],
                pagination: { page: 1, limit: 20, total: 0 },
            };

            jest.spyOn(directoryService, 'searchProviders').mockResolvedValue(mockResult);

            const result = await controller.findProviders({} as any, mockRequest as any);

            expect(result).toEqual(mockResult);
            expect(directoryService.searchProviders).toHaveBeenCalled();
        });
    });

    describe('getAvailableProviders', () => {
        it('should return list of available providers', async () => {
            jest.spyOn(availabilityService, 'getAvailableProviders').mockResolvedValue(mockAvailableProviders);

            const result = await controller.getAvailableProviders();

            expect(result).toEqual(mockAvailableProviders);
            expect(availabilityService.getAvailableProviders).toHaveBeenCalledWith(undefined);
        });

        it('should filter by specialization', async () => {
            jest.spyOn(availabilityService, 'getAvailableProviders').mockResolvedValue(mockAvailableProviders);

            const result = await controller.getAvailableProviders('Cardiology');

            expect(result).toEqual(mockAvailableProviders);
            expect(availabilityService.getAvailableProviders).toHaveBeenCalledWith('Cardiology');
        });
    });

    describe('getProviderAvailability', () => {
        it('should return provider availability', async () => {
            jest.spyOn(availabilityService, 'getAvailability').mockResolvedValue(mockAvailabilityResponse);

            const result = await controller.getProviderAvailability('provider-1');

            expect(result).toEqual(mockAvailabilityResponse);
            expect(availabilityService.getAvailability).toHaveBeenCalledWith('provider-1');
        });
    });

    describe('updateProviderAvailability', () => {
        it('should update provider availability', async () => {
            jest.spyOn(availabilityService, 'updateAvailability').mockResolvedValue(mockAvailabilityResponse);

            const updateDto = {
                isAcceptingPatients: false,
                maxPatients: 100,
            };

            const result = await controller.updateProviderAvailability(
                'provider-1',
                updateDto,
                mockRequest as any,
            );

            expect(result).toEqual(mockAvailabilityResponse);
            expect(availabilityService.updateAvailability).toHaveBeenCalledWith('provider-1', updateDto);
        });

        it('should throw ForbiddenException if updating other provider', async () => {
            const otherUserRequest = {
                user: {
                    id: 'other-provider',
                    email: 'other@test.com',
                    role: UserRole.PHYSICIAN,
                },
            };

            const updateDto = {
                isAcceptingPatients: false,
            };

            await expect(
                controller.updateProviderAvailability('provider-1', updateDto, otherUserRequest as any),
            ).rejects.toThrow(ForbiddenException);
        });

        it('should allow admin to update any provider', async () => {
            const adminRequest = {
                user: {
                    id: 'admin-1',
                    email: 'admin@test.com',
                    role: UserRole.ADMIN,
                },
            };

            jest.spyOn(availabilityService, 'updateAvailability').mockResolvedValue(mockAvailabilityResponse);

            const updateDto = {
                isAcceptingPatients: false,
            };

            const result = await controller.updateProviderAvailability(
                'provider-1',
                updateDto,
                adminRequest as any,
            );

            expect(result).toEqual(mockAvailabilityResponse);
        });
    });
});
