export class ProviderAvailabilityResponseDto {
    id: string;
    providerId: string;
    isAcceptingPatients: boolean;
    maxPatients: number;
    currentPatients: number;
    specializations: string[];
    createdAt: Date;
    updatedAt: Date;
}

export class AvailableProviderDto {
    id: string;
    displayName: string;
    specialty: string | null;
    institution: string | null;
    isAcceptingPatients: boolean;
    maxPatients: number;
    currentPatients: number;
    specializations: string[];
    availableSlots: number;
}
