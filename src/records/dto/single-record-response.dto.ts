import { ApiProperty } from '@nestjs/swagger';
import { RecordType } from './create-record.dto';

/**
 * Response DTO for GET /records/:id endpoint.
 * Includes record metadata but NOT raw IPFS CID for non-owners.
 */
export class SingleRecordResponseDto {
    @ApiProperty({
        description: 'Unique record identifier (UUID)',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    id: string;

    @ApiProperty({
        description: 'Patient ID (owner of the record)',
        example: 'patient-uuid-123',
    })
    patientId: string;

    @ApiProperty({
        description: 'Provider ID (who created the record)',
        example: 'provider-uuid-456',
        nullable: true,
    })
    providerId: string | null;

    @ApiProperty({
        enum: RecordType,
        description: 'Type of medical record',
        example: RecordType.MEDICAL_REPORT,
    })
    recordType: RecordType;

    @ApiProperty({
        description: 'Optional description of the record',
        example: 'Annual checkup report',
        nullable: true,
    })
    description: string | null;

    @ApiProperty({
        description: 'Record creation timestamp',
        example: '2024-01-15T10:30:00Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'IPFS CID (only visible to record owner)',
        example: 'QmXxxx...',
        nullable: true,
    })
    cid: string | null;

    @ApiProperty({
        description: 'Stellar transaction hash for anchoring (only visible to record owner)',
        example: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        nullable: true,
    })
    stellarTxHash: string | null;
}
