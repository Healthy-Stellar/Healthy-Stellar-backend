/**
 * Standard GraphQL operations used by the SDK and healthcare clients.
 *
 * These queries are registered in the persisted query store at deploy time
 * via the `register:graphql-queries` CLI script. Only these pre-registered
 * operations are accepted in production; development mode allows arbitrary
 * queries without registration for rapid iteration.
 *
 * Related: src/graphql/plugins/apq.plugin.ts
 * Related: src/graphql/services/apq.service.ts
 */

export const ME = `
  query Me {
    me {
      id
      email
      firstName
      lastName
      role
      createdAt
    }
  }
`;

export const RECORD = `
  query Record($id: ID!) {
    record(id: $id) {
      id
      title
      recordType
      fileUrl
      patientId
      uploadedById
      createdAt
      updatedAt
      ipfsHash
      stellarTxHash
    }
  }
`;

export const RECORDS = `
  query Records($filter: RecordFilterInput, $pagination: PaginationInput) {
    records(filter: $filter, pagination: $pagination) {
      edges {
        node {
          id
          title
          recordType
          fileUrl
          patientId
          uploadedById
          createdAt
          updatedAt
          ipfsHash
          stellarTxHash
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

export const ACCESS_GRANTS = `
  query AccessGrants($patientId: ID, $status: GrantStatus) {
    accessGrants(patientId: $patientId, status: $status) {
      id
      recordId
      grantedBy
      grantedTo
      permissions
      expiresAt
      revokedAt
      createdAt
      updatedAt
    }
  }
`;

export const AUDIT_LOG = `
  query AuditLog($resourceId: ID!, $pagination: PaginationInput) {
    auditLog(resourceId: $resourceId, pagination: $pagination) {
      edges {
        node {
          id
          resourceId
          actorId
          action
          createdAt
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

export const PROVIDER = `
  query Provider($id: ID!) {
    provider(id: $id) {
      id
      email
      firstName
      lastName
      role
      specialty
      createdAt
    }
  }
`;

export const PROVIDERS = `
  query Providers($search: String, $specialty: String) {
    providers(search: $search, specialty: $specialty) {
      id
      email
      firstName
      lastName
      role
      specialty
      createdAt
    }
  }
`;

export const UPLOAD_RECORD = `
  mutation UploadRecord($input: UploadRecordInput!) {
    uploadRecord(input: $input) {
      ... on UploadRecordSuccess {
        record {
          id
          title
          recordType
          fileUrl
          patientId
          uploadedById
          createdAt
        }
        jobId
        status
        estimatedCompletionTime
        idempotent
      }
      ... on ValidationError {
        message
        fieldErrors
      }
      ... on UnauthorizedError {
        message
      }
      ... on StellarTransactionError {
        message
        txHash
        errorCode
      }
    }
  }
`;

export const GRANT_ACCESS = `
  mutation GrantAccess($input: GrantAccessInput!) {
    grantAccess(input: $input) {
      ... on AccessGrantSuccess {
        grant {
          id
          recordId
          grantedBy
          grantedTo
          permissions
          expiresAt
          createdAt
        }
      }
      ... on NotFoundError {
        message
      }
      ... on UnauthorizedError {
        message
      }
      ... on ValidationError {
        message
        fieldErrors
      }
    }
  }
`;

export const REVOKE_ACCESS = `
  mutation RevokeAccess($grantId: ID!) {
    revokeAccess(grantId: $grantId) {
      ... on RevokeAccessSuccess {
        grantId
        revoked
      }
      ... on NotFoundError {
        message
      }
      ... on UnauthorizedError {
        message
      }
    }
  }
`;

export const UPDATE_PROFILE = `
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      ... on UpdateProfileSuccess {
        user {
          id
          email
          firstName
          lastName
          role
          phoneNumber
          specialty
          licenseNumber
          avatarUrl
        }
      }
      ... on ValidationError {
        message
        fieldErrors
      }
      ... on UnauthorizedError {
        message
      }
    }
  }
`;

export const REGISTER_DEVICE = `
  mutation RegisterDevice($input: RegisterDeviceInput!) {
    registerDevice(input: $input) {
      ... on RegisterDeviceSuccess {
        deviceId
        registered
      }
      ... on ValidationError {
        message
        fieldErrors
      }
      ... on UnauthorizedError {
        message
      }
    }
  }
`;

export const SUBMIT_GDPR_REQUEST = `
  mutation SubmitGdprRequest($type: GdprRequestType!) {
    submitGdprRequest(type: $type) {
      ... on GdprRequestSuccess {
        jobId
        status
        estimatedCompletionTime
      }
      ... on UnauthorizedError {
        message
      }
    }
  }
`;

export const PATIENT = `
  query Patient($id: ID!) {
    patient(id: $id) {
      id
      address
      name
      email
      createdAt
      updatedAt
    }
  }
`;

export const PATIENTS = `
  query Patients($limit: Int, $offset: Int) {
    patients(limit: $limit, offset: $offset) {
      id
      address
      name
      email
      createdAt
      updatedAt
    }
  }
`;

export const ALL_OPERATIONS = [
  ME,
  RECORD,
  RECORDS,
  ACCESS_GRANTS,
  AUDIT_LOG,
  PROVIDER,
  PROVIDERS,
  UPLOAD_RECORD,
  GRANT_ACCESS,
  REVOKE_ACCESS,
  UPDATE_PROFILE,
  REGISTER_DEVICE,
  SUBMIT_GDPR_REQUEST,
  PATIENT,
  PATIENTS,
];
