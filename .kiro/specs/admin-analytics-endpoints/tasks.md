# Implementation Plan: Admin Analytics Endpoints

## Overview

This implementation plan breaks down the Admin Analytics Endpoints feature into discrete coding tasks. The feature uses NestJS with TypeScript to create three analytics endpoints (overview, activity, top-providers) with PostgreSQL aggregation queries, Redis caching, and ADMIN role-based access control.

## Tasks

- [x] 1. Set up AnalyticsModule structure and dependencies
  - Create `src/analytics/analytics.module.ts` with NestJS module decorator
  - Import TypeOrmModule for database entities (User, MedicalRecord, AccessGrant, StellarTransaction)
  - Import CacheModule for Redis integration
  - Register AnalyticsController and AnalyticsService as providers
  - _Requirements: 1.1-1.6, 4.1-4.3, 5.1-5.4_

- [ ] 2. Create DTOs and response interfaces
  - [x] 2.1 Create analytics DTOs in `src/analytics/dto/`
    - Create `overview-response.dto.ts` with totalUsers, totalRecords, totalAccessGrants, activeGrants, stellarTransactions fields
    - Create `activity-query.dto.ts` with from and to date validation using class-validator
    - Create `activity-response.dto.ts` with daily time series structure (date, recordUploads, accessEvents)
    - Create `top-providers-response.dto.ts` with provider ranking structure (providerId, activeGrantCount)
    - _Requirements: 1.1-1.6, 2.1-2.2, 3.1-3.3_

  - [ ]* 2.2 Write unit tests for DTO validation
    - Test ActivityQueryDto validates date formats correctly
    - Test ActivityQueryDto rejects invalid date ranges
    - _Requirements: 2.4, 7.3_

- [ ] 3. Implement AnalyticsService with database queries
  - [x] 3.1 Create AnalyticsService in `src/analytics/analytics.service.ts`
    - Inject TypeORM repositories for User, MedicalRecord, AccessGrant, StellarTransaction entities
    - Inject CacheManager for Redis operations
    - _Requirements: 1.6, 5.1-5.4_

  - [x] 3.2 Implement getOverview() method
    - Write PostgreSQL COUNT queries for totalUsers, totalRecords, totalAccessGrants, stellarTransactions
    - Write query for activeGrants with WHERE clause filtering expired/revoked grants
    - Return OverviewResponseDto with all computed metrics
    - _Requirements: 1.1-1.6_

  - [ ]* 3.3 Write property test for getOverview()
    - **Property 1: Non-negative counts**
    - **Validates: Requirements 1.1-1.6**
    - Generate random database states, verify all counts >= 0
    - Verify activeGrants <= totalAccessGrants

  - [x] 3.4 Implement getActivity(from: Date, to: Date) method
    - Write PostgreSQL query using date_trunc('day', created_at) for MedicalRecord uploads
    - Write PostgreSQL query using date_trunc('day', accessed_at) for AccessGrant events
    - Use GROUP BY date_trunc('day', ...) and COUNT(*) aggregation
    - Return ActivityResponseDto with daily time series arrays
    - _Requirements: 2.1-2.3, 2.5_

  - [ ]* 3.5 Write property test for getActivity()
    - **Property 2: Date range consistency**
    - **Validates: Requirements 2.1-2.3**
    - Generate random date ranges, verify all returned dates fall within [from, to]
    - Verify time series is sorted chronologically

  - [x] 3.6 Implement getTopProviders() method
    - Write PostgreSQL query with JOIN between Provider and AccessGrant tables
    - Use WHERE clause to filter only active grants (not expired/revoked)
    - Use GROUP BY provider_id and COUNT(*) with ORDER BY count DESC
    - Return TopProvidersResponseDto with ranked provider list
    - _Requirements: 3.1-3.3_

  - [ ]* 3.7 Write property test for getTopProviders()
    - **Property 3: Ranking order**
    - **Validates: Requirements 3.1-3.3**
    - Generate random provider/grant data, verify list is sorted descending by activeGrantCount
    - Verify all counts are non-negative

- [x] 4. Checkpoint - Ensure service logic tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement Redis caching layer
  - [x] 5.1 Add caching logic to AnalyticsService methods
    - Wrap getOverview() with cache check using key 'analytics:overview'
    - Wrap getActivity() with cache check using key 'analytics:activity:{from}:{to}'
    - Wrap getTopProviders() with cache check using key 'analytics:top-providers'
    - Set TTL to 300 seconds for all cached responses
    - _Requirements: 5.1-5.4_

  - [ ]* 5.2 Write unit tests for caching behavior
    - Mock CacheManager, verify cache.get() called before database queries
    - Verify cache.set() called with 300-second TTL after database queries
    - Verify cached responses returned when cache hit occurs
    - _Requirements: 5.1-5.4, 7.2_

  - [ ]* 5.3 Write property test for cache consistency
    - **Property 4: Cache freshness**
    - **Validates: Requirements 5.1-5.4**
    - Verify cached response matches fresh database query within TTL window

- [ ] 6. Implement AnalyticsController with endpoints
  - [x] 6.1 Create AnalyticsController in `src/analytics/analytics.controller.ts`
    - Add @Controller('admin/analytics') decorator
    - Inject AnalyticsService
    - _Requirements: 1.1-1.6, 2.1-2.5, 3.1-3.3_

  - [x] 6.2 Implement GET /admin/analytics/overview endpoint
    - Add @Get('overview') decorator
    - Call analyticsService.getOverview()
    - Return OverviewResponseDto
    - _Requirements: 1.1-1.6_

  - [x] 6.3 Implement GET /admin/analytics/activity endpoint
    - Add @Get('activity') decorator with @Query() ActivityQueryDto parameter
    - Validate from and to dates using class-validator
    - Return 400 error for invalid date parameters
    - Call analyticsService.getActivity(from, to)
    - Return ActivityResponseDto
    - _Requirements: 2.1-2.5_

  - [-] 6.4 Implement GET /admin/analytics/top-providers endpoint
    - Add @Get('top-providers') decorator
    - Call analyticsService.getTopProviders()
    - Return TopProvidersResponseDto
    - _Requirements: 3.1-3.3_

  - [ ]* 6.5 Write unit tests for controller endpoints
    - Mock AnalyticsService, verify correct methods called with correct parameters
    - Test error handling for invalid date parameters
    - _Requirements: 7.1-7.4_

- [ ] 7. Implement role-based access control
  - [x] 7.1 Create AdminGuard in `src/auth/guards/admin.guard.ts`
    - Implement CanActivate interface
    - Extract user from request context
    - Verify user.role === 'ADMIN'
    - Return false (403) if not admin, true if admin
    - Handle unauthenticated requests (401)
    - _Requirements: 4.1-4.3_

  - [x] 7.2 Apply AdminGuard to AnalyticsController
    - Add @UseGuards(AdminGuard) decorator to AnalyticsController class
    - Verify guard applies to all three endpoints
    - _Requirements: 4.1-4.3_

  - [ ]* 7.3 Write unit tests for AdminGuard
    - Test guard returns true for ADMIN role users
    - Test guard returns false for non-ADMIN role users
    - Test guard handles unauthenticated requests
    - _Requirements: 4.1-4.3, 7.4_

  - [ ]* 7.4 Write property test for access control
    - **Property 5: Authorization enforcement**
    - **Validates: Requirements 4.1-4.3**
    - Generate random user roles, verify only ADMIN role can access endpoints

- [x] 8. Checkpoint - Ensure access control tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Add database indexes for performance optimization
  - [x] 9.1 Create migration for analytics indexes
    - Add index on medical_records(created_at) for activity queries
    - Add index on access_grants(accessed_at) for activity queries
    - Add index on access_grants(provider_id, status) for top providers query
    - Add index on access_grants(expires_at, revoked) for active grants filtering
    - _Requirements: 6.1-6.3_

  - [ ]* 9.2 Write property test for query performance
    - **Property 6: Response time constraint**
    - **Validates: Requirements 6.1**
    - Generate dataset with 1,000,000 records, verify response time < 500ms

- [ ] 10. Add comprehensive property-based tests
  - [ ]* 10.1 Write property test for data consistency
    - **Property 7: Aggregate consistency**
    - **Validates: Requirements 1.1-1.6**
    - Verify sum of daily activity counts equals total record/grant counts

  - [ ]* 10.2 Write property test for time series completeness
    - **Property 8: Date range coverage**
    - **Validates: Requirements 2.1-2.3**
    - Verify activity endpoint returns data for all days in requested range (including zero-count days)

  - [ ]* 10.3 Write property test for provider ranking uniqueness
    - **Property 9: Unique provider IDs**
    - **Validates: Requirements 3.1-3.3**
    - Verify top providers list contains no duplicate provider IDs

  - [ ]* 10.4 Write property test for cache invalidation
    - **Property 10: Cache expiration**
    - **Validates: Requirements 5.1-5.4**
    - Verify cached responses expire after 300 seconds and fresh data is fetched

- [ ] 11. Integration and final wiring
  - [x] 11.1 Register AnalyticsModule in AppModule
    - Import AnalyticsModule in `src/app.module.ts`
    - Verify module dependencies (TypeOrmModule, CacheModule) are configured
    - _Requirements: All_

  - [-] 11.2 Add API documentation
    - Add Swagger decorators (@ApiTags, @ApiResponse) to controller endpoints
    - Document query parameters and response schemas
    - _Requirements: All_

  - [ ]* 11.3 Write integration tests for complete flows
    - Test complete request flow: authentication → authorization → caching → database query → response
    - Test error scenarios: invalid dates, unauthorized access, database errors
    - _Requirements: All_

- [x] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property-based tests validate universal correctness properties from the design
- Unit tests validate specific examples and edge cases
- Database indexes are critical for meeting the 500ms performance requirement
- Redis caching reduces database load for repeated queries
- All endpoints are protected by ADMIN role guard
