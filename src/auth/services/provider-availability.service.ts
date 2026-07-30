import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProviderAvailability } from '../entities/provider-availability.entity';
import { User, UserRole } from '../entities/user.entity';
import { UpdateProviderAvailabilityDto } from '../dto/update-provider-availability.dto';
import { ProviderAvailabilityResponseDto, AvailableProviderDto } from '../dto/provider-availability-response.dto';

@Injectable()
export class ProviderAvailabilityService {
    constructor(
        @InjectRepository(ProviderAvailability)
        private readonly availabilityRepository: Repository<ProviderAvailability>,
        @InjectRepository(User)
        private readonly usersRepository: Repository<User>,
    ) { }

    /**
     * Get or create provider availability record
     */
    async getOrCreateAvailability(providerId: string): Promise<ProviderAvailability> {
        let availability = await this.availabilityRepository.findOne({
            where: { providerId },
        });

        if (!availability) {
            const provider = await this.usersRepository.findOne({
                where: { id: providerId },
            });

            if (!provider) {
                throw new NotFoundException('Provider not found');
            }

            availability = this.availabilityRepository.create({
                providerId,
                isAcceptingPatients: provider.isAcceptingPatients,
                maxPatients: 0,
                currentPatients: 0,
                specializations: provider.specialization ? [provider.specialization] : [],
            });

            await this.availabilityRepository.save(availability);
        }

        return availability;
    }

    /**
     * Update provider availability and capacity
     */
    async updateAvailability(
        providerId: string,
        updateDto: UpdateProviderAvailabilityDto,
    ): Promise<ProviderAvailabilityResponseDto> {
        const availability = await this.getOrCreateAvailability(providerId);

        if (updateDto.isAcceptingPatients !== undefined) {
            availability.isAcceptingPatients = updateDto.isAcceptingPatients;
        }

        if (updateDto.maxPatients !== undefined) {
            if (updateDto.maxPatients < availability.currentPatients) {
                throw new BadRequestException(
                    `maxPatients cannot be less than currentPatients (${availability.currentPatients})`,
                );
            }
            availability.maxPatients = updateDto.maxPatients;
        }

        if (updateDto.specializations !== undefined) {
            availability.specializations = updateDto.specializations;
        }

        const updated = await this.availabilityRepository.save(availability);
        return this.mapToResponseDto(updated);
    }

    /**
     * Get provider availability
     */
    async getAvailability(providerId: string): Promise<ProviderAvailabilityResponseDto> {
        const availability = await this.getOrCreateAvailability(providerId);
        return this.mapToResponseDto(availability);
    }

    /**
     * Increment current patient count
     */
    async incrementCurrentPatients(providerId: string, count: number = 1): Promise<void> {
        const availability = await this.getOrCreateAvailability(providerId);

        if (availability.currentPatients + count > availability.maxPatients && availability.maxPatients > 0) {
            throw new BadRequestException(
                `Cannot exceed maximum patient capacity (${availability.maxPatients})`,
            );
        }

        availability.currentPatients += count;
        await this.availabilityRepository.save(availability);
    }

    /**
     * Decrement current patient count
     */
    async decrementCurrentPatients(providerId: string, count: number = 1): Promise<void> {
        const availability = await this.getOrCreateAvailability(providerId);

        availability.currentPatients = Math.max(0, availability.currentPatients - count);
        await this.availabilityRepository.save(availability);
    }

    /**
     * Get list of available providers, optionally filtered by specialization
     */
    async getAvailableProviders(specialization?: string): Promise<AvailableProviderDto[]> {
        const qb = this.availabilityRepository
            .createQueryBuilder('pa')
            .innerJoinAndSelect('pa.provider', 'u')
            .where('pa.isAcceptingPatients = :isAccepting', { isAccepting: true })
            .andWhere('u.isActive = :isActive', { isActive: true })
            .andWhere('u.isLicenseVerified = :isVerified', { isVerified: true })
            .andWhere('u.deletedAt IS NULL')
            .andWhere('u.role IN (:...roles)', {
                roles: [UserRole.PHYSICIAN, UserRole.MEDICAL_RECORDS, UserRole.BILLING_STAFF],
            });

        if (specialization) {
            qb.andWhere(
                `(pa.specializations @> ARRAY[:specialization] OR u.specialization ILIKE :spec OR u.specialty ILIKE :spec)`,
                {
                    specialization,
                    spec: `%${specialization}%`,
                },
            );
        }

        qb.orderBy('pa.updatedAt', 'DESC');

        const availabilities = await qb.getMany();

        return availabilities.map((av) => ({
            id: av.provider.id,
            displayName: av.provider.displayName || `${av.provider.firstName} ${av.provider.lastName}`,
            specialty: av.provider.specialty || av.provider.specialization,
            institution: av.provider.institution,
            isAcceptingPatients: av.isAcceptingPatients,
            maxPatients: av.maxPatients,
            currentPatients: av.currentPatients,
            specializations: av.specializations || [],
            availableSlots: av.maxPatients > 0 ? Math.max(0, av.maxPatients - av.currentPatients) : 0,
        }));
    }

    /**
     * Check if provider can accept more patients
     */
    async canAcceptPatient(providerId: string): Promise<boolean> {
        const availability = await this.getOrCreateAvailability(providerId);

        if (!availability.isAcceptingPatients) {
            return false;
        }

        if (availability.maxPatients > 0 && availability.currentPatients >= availability.maxPatients) {
            return false;
        }

        return true;
    }

    private mapToResponseDto(availability: ProviderAvailability): ProviderAvailabilityResponseDto {
        return {
            id: availability.id,
            providerId: availability.providerId,
            isAcceptingPatients: availability.isAcceptingPatients,
            maxPatients: availability.maxPatients,
            currentPatients: availability.currentPatients,
            specializations: availability.specializations || [],
            createdAt: availability.createdAt,
            updatedAt: availability.updatedAt,
        };
    }
}
