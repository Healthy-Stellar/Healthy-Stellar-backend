# Healthy-Stellar-backend

NestJS Backend Documentation - Decentralized Healthcare System
Comprehensive documentation for the NestJS backend that interfaces with Stellar Soroban smart contracts for the decentralized healthcare management system.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Installation & Setup](#installation--setup)
- [Configuration](#configuration)
- [Core Modules](#core-modules)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Medical Records System](#medical-records-system)
- [Authentication & Authorization](#authentication--authorization)
- [Stellar Integration](#stellar-integration)
- [Error Handling](#error-handling)
- [Testing](#testing)
- [Deployment](#deployment)

## Architecture Overview

The NestJS backend serves as the application layer between the frontend and Stellar blockchain, providing:

- RESTful API endpoints for client applications
- Off-chain data caching and indexing
- User authentication and session management
- Encryption/decryption of sensitive health data
- Event listening and blockchain synchronization
- Business logic orchestration
- File upload and storage management

## Project Structure

```
src/
├── main.ts                          # Application entry point
├── app.module.ts                    # Root application module
├── config/
│   └── database.config.ts           # Database configuration
├── common/
│   └── filters/
│       └── http-exception.filter.ts  # Global exception filter
└── medical-records/
    ├── medical-records.module.ts    # Medical records module
    ├── entities/                     # Database entities
    │   ├── medical-record.entity.ts
    │   ├── medical-record-version.entity.ts
    │   ├── medical-history.entity.ts
    │   ├── clinical-note-template.entity.ts
    │   ├── medical-attachment.entity.ts
    │   └── medical-record-consent.entity.ts
    ├── dto/                          # Data Transfer Objects
    │   ├── create-medical-record.dto.ts
    │   ├── update-medical-record.dto.ts
    │   ├── search-medical-records.dto.ts
    │   ├── create-consent.dto.ts
    │   └── create-clinical-template.dto.ts
    ├── services/                     # Business logic services
    │   ├── medical-records.service.ts
    │   ├── clinical-templates.service.ts
    │   ├── consent.service.ts
    │   ├── file-upload.service.ts
    │   └── reporting.service.ts
    └── controllers/                  # API controllers
        ├── medical-records.controller.ts
        ├── clinical-templates.controller.ts
        ├── consent.controller.ts
        ├── file-upload.controller.ts
        └── reporting.controller.ts
```

## Installation & Setup

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

### Installation Steps

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file from `.env.example`:
```bash
cp .env.example .env
```

3. Update the `.env` file with your database credentials and configuration.

4. Run database migrations (if using migrations):
```bash
npm run migration:run
```

5. Start the development server:
```bash
npm run start:dev
```

The application will be available at `http://localhost:3000`
Swagger documentation will be available at `http://localhost:3000/api`

## Configuration

### Environment Variables

- `DB_HOST` - Database host (default: localhost)
- `DB_PORT` - Database port (default: 5432)
- `DB_USERNAME` - Database username (default: postgres)
- `DB_PASSWORD` - Database password (default: postgres)
- `DB_NAME` - Database name (default: healthy_stellar)
- `PORT` - Application port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `UPLOAD_PATH` - File upload directory (default: ./storage/uploads)
- `JWT_SECRET` - JWT secret key for authentication
- `JWT_EXPIRES_IN` - JWT expiration time

## Core Modules

### Medical Records Module

The medical records module provides comprehensive functionality for managing medical records, including:

- Medical record CRUD operations
- Version control and audit trails
- Clinical note templates
- Medical history and timeline tracking
- File attachments (images, documents)
- Consent management
- Search and reporting

## API Endpoints

### Medical Records

- `POST /medical-records` - Create a new medical record
- `GET /medical-records/search` - Search medical records
- `GET /medical-records/:id` - Get a medical record by ID
- `GET /medical-records/:id/versions` - Get version history
- `GET /medical-records/timeline/:patientId` - Get patient timeline
- `PUT /medical-records/:id` - Update a medical record
- `PUT /medical-records/:id/archive` - Archive a medical record
- `PUT /medical-records/:id/restore` - Restore an archived record
- `DELETE /medical-records/:id` - Delete a medical record (soft delete)

### Clinical Templates

- `POST /clinical-templates` - Create a clinical template
- `GET /clinical-templates` - Get all active templates
- `GET /clinical-templates/:id` - Get a template by ID
- `PUT /clinical-templates/:id` - Update a template
- `DELETE /clinical-templates/:id` - Delete a template

### Consent Management

- `POST /consents` - Create a new consent
- `GET /consents/record/:recordId` - Get consents for a record
- `GET /consents/patient/:patientId` - Get consents for a patient
- `GET /consents/check` - Check if consent exists
- `GET /consents/:id` - Get a consent by ID
- `PUT /consents/:id/revoke` - Revoke a consent

### File Attachments

- `POST /attachments/upload` - Upload a file attachment
- `GET /attachments/record/:recordId` - Get attachments for a record
- `GET /attachments/:id` - Get an attachment by ID
- `GET /attachments/:id/download` - Download an attachment
- `DELETE /attachments/:id` - Delete an attachment

### Reporting

- `GET /reports/patient/:patientId/summary` - Get patient summary
- `GET /reports/activity` - Get activity report
- `GET /reports/consent` - Get consent report
- `GET /reports/statistics` - Get statistics

## Database Schema

### Medical Records

The system uses the following main entities:

1. **MedicalRecord** - Main medical record entity with version control
2. **MedicalRecordVersion** - Version history for audit trails
3. **MedicalHistory** - Timeline and activity tracking
4. **ClinicalNoteTemplate** - Reusable clinical note templates
5. **MedicalAttachment** - File attachments (images, documents)
6. **MedicalRecordConsent** - Consent management and sharing

## Medical Records System

### Features

#### 1. Medical Record Entity with Version Control
- Complete version history tracking
- Change tracking with before/after states
- Change reason documentation
- Automatic version numbering

#### 2. Clinical Note Templates and Structured Data
- Reusable templates for common clinical notes
- Structured field definitions
- Template categorization
- System and custom templates

#### 3. Medical History and Timeline Tracking
- Complete audit trail of all record activities
- Event types: created, updated, viewed, shared, archived, deleted
- IP address and user agent tracking
- Chronological timeline view

#### 4. Medical Image and Document Attachment
- Support for multiple file types (images, PDFs, documents)
- File size validation (10MB max)
- Secure file storage
- Metadata tracking

#### 5. Medical Record Sharing and Consent Management
- Granular consent types (view, share, download, modify, delete)
- Consent expiration management
- Consent revocation with reason tracking
- Sharing with users and organizations

#### 6. Medical Record Search and Reporting
- Advanced search with filters
- Patient summary reports
- Activity reports
- Consent reports
- Statistical analysis

### Acceptance Criteria Met

✅ **Medical records maintain complete audit trails**
- All changes are tracked in MedicalRecordVersion
- All activities are logged in MedicalHistory
- IP addresses and user agents are recorded

✅ **Clinical documentation follows medical standards**
- Structured templates for consistent documentation
- Version control ensures data integrity
- Metadata support for additional context

✅ **Medical history is easily accessible and searchable**
- Timeline endpoint for chronological view
- Search functionality with multiple filters
- Activity reports for analysis

✅ **Patient consent is properly managed and documented**
- Comprehensive consent entity with status tracking
- Expiration management
- Revocation with audit trail
- Consent verification endpoints

## Authentication & Authorization

(To be implemented - placeholder for future authentication system)

## Stellar Integration

(To be implemented - placeholder for Stellar Soroban smart contract integration)

## Error Handling

The application uses a global exception filter (`HttpExceptionFilter`) that:
- Catches all exceptions
- Formats error responses consistently
- Logs errors appropriately
- Provides detailed error information in development
- Sanitizes error messages in production

## Testing

### Running Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Deployment

### Production Build

```bash
npm run build
npm run start:prod
```

### Environment Considerations

- Set `NODE_ENV=production`
- Configure proper database credentials
- Set up secure file storage
- Configure CORS appropriately
- Enable HTTPS
- Set up proper logging and monitoring

## License

MIT
