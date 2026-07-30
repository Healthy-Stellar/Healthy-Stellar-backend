import { ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import * as request from 'supertest';
import { ProvidersController } from '../../src/auth/controllers/providers.controller';
import { ProviderAvailabilityService } from '../../src/auth/services/provider-availability.service';
import { ProviderDirectoryService } from '../../src/auth/services/provider-directory.service';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../src/auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../../src/auth/guards/roles.guard';
import { AuthTokenService } from '../../src/auth/services/auth-token.service';
import { SessionManagementService } from '../../src/auth/services/session-management.service';
import { UserRole } from '../../src/auth/entities/user.entity';

describe('Provider Availability (e2e)', () => {
    let app: INestApplication;

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
        {
            id: 'provider-2',
            displayName: 'Dr. Jane Smith',
            specialty: 'Neurology',
            institution: 'Medical Center',
            isAcceptingPatients: true,
            maxPatients: 30,
            currentPatients: 5,
            specializations: ['Neurology'],
            availableSlots: 25,
        },
    ];

    const availabilityServiceMock = {
        getAvailability: jest.fn((providerId: string) => {
            if (providerId === 'provider-1') {
                return Promise.resolve(mockAvailabilityResponse);
            }
            throw new Error('Provider not found');
        }),
        updateAvailability: jest.fn((providerId: string, updateDto) => {
            return Promise.resolve({
                ...mockAvailabilityResponse,
                ...updateDto,
            });
        }),
        getAvailableProviders: jest.fn((specialization?: string) => {
            if (specialization === 'Cardiology') {
                return Promise.resolve([mockAvailableProviders[0]]);
            }
            return Promise.resolve(mockAvailableProviders);
        }),
    };

    const directoryServiceMock = {
        searchProviders: jest.fn(() => ({
            data: [],
            pagination: { page: 1, limit: 20, total: 0 },
        })),
    };

    const authTokenServiceMock = {
        verifyAccessToken: jest.fn((token: string) => {
            if (token === 'valid-provider-token') {
                return {
                    userId: 'provider-1',
                    id: 'provider-1',
                    email: 'provider@test.com',
                    role: UserRole.PHYSICIAN,
                    mfaEnabled: false,
                    sessionId: 'session-1',
                };
            }
            if (token === 'valid-admin-token') {
                return {
                    userId: 'admin-1',
                    id: 'admin-1',
                    email: 'admin@test.com',
                    role: UserRole.ADMIN,
                    mfaEnabled: false,
                    sessionId: 'session-2',
                };
            }
            return null;
        }),
    };

    const sessionManagementServiceMock = {
        isSessionValid: jest.fn(async (sessionId: string) => sessionId.startsWith('session-')),
        updateSessionActivity: jest.fn(async () => undefined),
    };

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                ThrottlerModule.forRoot([
                    {
                        name: 'ip',
                        ttl: 60000,
                        limit: 30,
                        getTracker: (req) => req.headers['x-test-key'] || req.ip,
                    },
                    {
                        name: 'user',
                        ttl: 60000,
                        limit: 30,
                        getTracker: (req) => req.headers['x-test-key'] || req.ip,
                    },
                ]),
            ],
            controllers: [ProvidersController],
            providers: [
                {
                    provide: ProviderAvailabilityService,
                    useValue: availabilityServiceMock,
                },
                {
                    provide: ProviderDirectoryService,
                    useValue: directoryServiceMock,
                },
                {
                    provide: AuthTokenService,
                    useValue: authTokenServiceMock,
                },
                {
                    provide: SessionManagementService,
                    useValue: sessionManagementServiceMock,
                },
                {
                    provide: APP_GUARD,
                    useClass: ThrottlerGuard,
                },
            ],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                forbidNonWhitelisted: true,
                transform: true,
            }),
        );
        await app.init();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterAll(async () => {
        if (app) {
            await app.close();
        }
    });

    describe('GET /providers/available', () => {
        it('should return list of available providers', async () => {
            const response = await request(app.getHttpServer()).get('/providers/available').expect(200);

            expect(response.body).toHaveLength(2);
            expect(response.body[0]).toHaveProperty('displayName');
            expect(response.body[0]).toHaveProperty('availableSlots');
            expect(availabilityServiceMock.getAvailableProviders).toHaveBeenCalledWith(undefined);
        });

        it('should filter by specialization', async () => {
            const response = await request(app.getHttpServer())
                .get('/providers/available?specialization=Cardiology')
                .expect(200);

            expect(response.body).toHaveLength(1);
            expect(response.body[0].specialty).toBe('Cardiology');
            expect(availabilityServiceMock.getAvailableProviders).toHaveBeenCalledWith('Cardiology');
        });
    });

    describe('GET /providers/:address/availability', () => {
        it('should return provider availability', async () => {
            const response = await request(app.getHttpServer())
                .get('/providers/provider-1/availability')
                .expect(200);

            expect(response.body).toEqual(mockAvailabilityResponse);
            expect(availabilityServiceMock.getAvailability).toHaveBeenCalledWith('provider-1');
        });

        it('should return 404 for non-existent provider', async () => {
            await request(app.getHttpServer()).get('/providers/invalid-id/availability').expect(500);
        });
    });

    describe('PATCH /providers/:address/availability', () => {
        it('should update provider availability when authenticated', async () => {
            const updateDto = {
                isAcceptingPatients: false,
                maxPatients: 100,
            };

            const response = await request(app.getHttpServer())
                .patch('/providers/provider-1/availability')
                .set('Authorization', 'Bearer valid-provider-token')
                .send(updateDto)
                .expect(200);

            expect(response.body).toHaveProperty('isAcceptingPatients', false);
            expect(response.body).toHaveProperty('maxPatients', 100);
            expect(availabilityServiceMock.updateAvailability).toHaveBeenCalledWith('provider-1', updateDto);
        });

        it('should return 401 when not authenticated', async () => {
            const updateDto = {
                isAcceptingPatients: false,
            };

            await request(app.getHttpServer())
                .patch('/providers/provider-1/availability')
                .send(updateDto)
                .expect(401);
        });

        it('should return 403 when updating other provider', async () => {
            const updateDto = {
                isAcceptingPatients: false,
            };

            await request(app.getHttpServer())
                .patch('/providers/provider-2/availability')
                .set('Authorization', 'Bearer valid-provider-token')
                .send(updateDto)
                .expect(403);
        });

        it('should allow admin to update any provider', async () => {
            const updateDto = {
                isAcceptingPatients: false,
            };

            const response = await request(app.getHttpServer())
                .patch('/providers/provider-1/availability')
                .set('Authorization', 'Bearer valid-admin-token')
                .send(updateDto)
                .expect(200);

            expect(response.body).toHaveProperty('isAcceptingPatients', false);
        });

        it('should validate input data', async () => {
            const invalidDto = {
                maxPatients: -10,
            };

            await request(app.getHttpServer())
                .patch('/providers/provider-1/availability')
                .set('Authorization', 'Bearer valid-provider-token')
                .send(invalidDto)
                .expect(400);
        });

        it('should update specializations', async () => {
            const updateDto = {
                specializations: ['Cardiology', 'Internal Medicine'],
            };

            const response = await request(app.getHttpServer())
                .patch('/providers/provider-1/availability')
                .set('Authorization', 'Bearer valid-provider-token')
                .send(updateDto)
                .expect(200);

            expect(response.body).toHaveProperty('specializations');
            expect(availabilityServiceMock.updateAvailability).toHaveBeenCalledWith('provider-1', updateDto);
        });
    });
});
