import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsUUID, IsDate, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export enum TimelineEventType {
    RECORD_CREATED = 'RECORD_CREATED',
    RECORD_UPDATED = 'RECORD_UPDATED',
    ACCESS_GRANTED = 'ACCESS_GRANTED',
    ACCESS_REVOKED = 'ACCESS_REVOKED',
    PROFILE_UPDATED = 'PROFILE_UPDATED',
}

export class TimelineEvent {
    @ApiProperty({ description: 'Unique event ID' })
    @IsUUID()
    id: string;

    @ApiProperty({ enum: TimelineEventType, description: 'Type of event' })
    @IsEnum(TimelineEventType)
    eventType: TimelineEventType;

    @ApiProperty({ description: 'Event timestamp' })
    @IsDate()
    timestamp: Date;

    @ApiProperty({ description: 'Event description' })
    @IsString()
    description: string;

    @ApiProperty({ description: 'User who performed the action', nullable: true })
    @IsUUID()
    @IsOptional()
    performedBy?: string;

    @ApiProperty({ description: 'Name of user who performed the action', nullable: true })
    @IsString()
    @IsOptional()
    performedByName?: string;

    @ApiProperty({ description: 'Additional event metadata', nullable: true })
    @IsOptional()
    metadata?: Record<string, any>;

    @ApiProperty({ description: 'Related resource ID', nullable: true })
    @IsUUID()
    @IsOptional()
    resourceId?: string;

    @ApiProperty({ description: 'Related resource type', nullable: true })
    @IsString()
    @IsOptional()
    resourceType?: string;
}

export class PatientTimelineDto {
    @ApiProperty({ description: 'Page number', default: 1 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @IsOptional()
    page?: number = 1;

    @ApiProperty({ description: 'Items per page', default: 20, maximum: 100 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    @IsOptional()
    limit?: number = 20;
}

export class PatientTimelineResponse {
    @ApiProperty({ type: [TimelineEvent], description: 'Timeline events sorted by timestamp descending' })
    data: TimelineEvent[];

    @ApiProperty({ description: 'Total number of events' })
    total: number;

    @ApiProperty({ description: 'Current page' })
    page: number;

    @ApiProperty({ description: 'Items per page' })
    limit: number;

    @ApiProperty({ description: 'Total pages' })
    totalPages: number;
}
