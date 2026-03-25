# Requirements Document

## Introduction

The Admin Analytics Endpoints feature provides system administrators with aggregate metrics about platform usage, enabling health monitoring, anomaly detection, and activity reporting. The feature exposes RESTful endpoints that leverage PostgreSQL aggregation queries and Redis caching to deliver performance-optimized analytics data.

## Glossary

- **Analytics_Service**: The backend service responsible for computing and serving aggregate metrics
- **Admin_User**: A user with ADMIN role privileges
- **Overview_Endpoint**: The GET /admin/analytics/overview endpoint
- **Activity_Endpoint**: The GET /admin/analytics/activity endpoint
- **Top_Providers_Endpoint**: The GET /admin/analytics/top-providers endpoint
- **Cache_Layer**: Redis-based caching mechanism for analytics responses
- **Access_Grant**: A blockchain-recorded permission allowing access to medical records
- **Active_Grant**: An access grant that is currently valid (not expired or revoked)
- **Record_Upload**: The event of uploading a medical record to the system
- **Access_Event**: The event of accessing a medical record through an access grant
- **Provider**: A healthcare provider entity in the system
- **Time_Series**: A sequence of data points indexed by time (daily granularity)
- **Dataset**: The collection of all records in the PostgreSQL database

## Requirements

### Requirement 1: System Overview Metrics

**User Story:** As an administrator, I want to view aggregate system metrics, so that I can monitor overall platform health and usage.

#### Acceptance Criteria

1. WHEN an Admin_User requests the Overview_Endpoint, THE Analytics_Service SHALL return totalUsers as the count of all users
2. WHEN an Admin_User requests the Overview_Endpoint, THE Analytics_Service SHALL return totalRecords as the count of all medical records
3. WHEN an Admin_User requests the Overview_Endpoint, THE Analytics_Service SHALL return totalAccessGrants as the count of all access grants
4. WHEN an Admin_User requests the Overview_Endpoint, THE Analytics_Service SHALL return activeGrants as the count of all Active_Grants
5. WHEN an Admin_User requests the Overview_Endpoint, THE Analytics_Service SHALL return stellarTransactions as the count of all Stellar blockchain transactions
6. WHEN the Overview_Endpoint is requested, THE Analytics_Service SHALL compute all metrics using PostgreSQL aggregation queries

### Requirement 2: Activity Time Series

**User Story:** As an administrator, I want to view daily activity trends over a date range, so that I can identify usage patterns and anomalies.

#### Acceptance Criteria

1. WHEN an Admin_User requests the Activity_Endpoint with from and to parameters, THE Analytics_Service SHALL return daily Record_Upload counts as a Time_Series
2. WHEN an Admin_User requests the Activity_Endpoint with from and to parameters, THE Analytics_Service SHALL return daily Access_Event counts as a Time_Series
3. WHEN the Activity_Endpoint is requested, THE Analytics_Service SHALL use PostgreSQL date_trunc function to group events by day
4. WHEN the Activity_Endpoint is requested with invalid date parameters, THE Analytics_Service SHALL return a 400 error with a descriptive message
5. WHEN the Activity_Endpoint is requested, THE Analytics_Service SHALL compute aggregations using PostgreSQL GROUP BY clauses

### Requirement 3: Top Providers Ranking

**User Story:** As an administrator, I want to see which providers have the most active access grants, so that I can understand provider engagement levels.

#### Acceptance Criteria

1. WHEN an Admin_User requests the Top_Providers_Endpoint, THE Analytics_Service SHALL return a list of Providers ranked by Active_Grant count
2. WHEN the Top_Providers_Endpoint is requested, THE Analytics_Service SHALL compute rankings using PostgreSQL aggregation queries
3. WHEN the Top_Providers_Endpoint is requested, THE Analytics_Service SHALL include the Provider identifier and Active_Grant count for each Provider

### Requirement 4: Role-Based Access Control

**User Story:** As a system architect, I want analytics endpoints restricted to administrators, so that sensitive metrics remain confidential.

#### Acceptance Criteria

1. WHEN a non-Admin_User requests any analytics endpoint, THE Analytics_Service SHALL return a 403 Forbidden error
2. WHEN an unauthenticated user requests any analytics endpoint, THE Analytics_Service SHALL return a 401 Unauthorized error
3. THE Analytics_Service SHALL verify ADMIN role before processing any analytics request

### Requirement 5: Response Caching

**User Story:** As a system architect, I want analytics responses cached, so that database load is minimized for repeated queries.

#### Acceptance Criteria

1. WHEN the Analytics_Service computes an analytics response, THE Cache_Layer SHALL store the response with a 300-second TTL
2. WHEN an analytics endpoint is requested, THE Analytics_Service SHALL check the Cache_Layer before querying the database
3. WHEN a cached response exists and is not expired, THE Analytics_Service SHALL return the cached response
4. WHEN a cached response does not exist or is expired, THE Analytics_Service SHALL query the database and update the Cache_Layer

### Requirement 6: Performance Requirements

**User Story:** As a system architect, I want analytics endpoints to respond quickly, so that administrators have a responsive experience.

#### Acceptance Criteria

1. WHEN any analytics endpoint is requested with a Dataset of 1,000,000 records, THE Analytics_Service SHALL respond within 500 milliseconds
2. THE Analytics_Service SHALL use database indexes to optimize query performance
3. THE Analytics_Service SHALL avoid in-memory aggregation of large datasets

### Requirement 7: Unit Testing

**User Story:** As a developer, I want unit tests for analytics logic, so that I can verify correctness without database dependencies.

#### Acceptance Criteria

1. THE Analytics_Service unit tests SHALL mock all database queries
2. THE Analytics_Service unit tests SHALL mock all Cache_Layer interactions
3. THE Analytics_Service unit tests SHALL verify correct response structure for each endpoint
4. THE Analytics_Service unit tests SHALL verify role-based access control enforcement
