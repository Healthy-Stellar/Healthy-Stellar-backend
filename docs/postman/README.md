# MedChain API Postman Collection

This Postman collection provides a comprehensive set of requests for testing and exploring the MedChain API - a blockchain-based medical records management system.

## Files

- `MedChain.postman_collection.json` - Main collection with all API endpoints
- `MedChain.Local.postman_environment.json` - Environment for local development
- `MedChain.Testnet.postman_environment.json` - Environment for testnet testing
- `MedChain.Staging.postman_environment.json` - Environment for staging testing

## Setup Instructions

### 1. Import the Collection and Environments

1. Open Postman
2. Click "Import" in the top left
3. Select "File" tab
4. Choose `MedChain.postman_collection.json`
5. Repeat for each environment file:
   - `MedChain.Local.postman_environment.json`
   - `MedChain.Testnet.postman_environment.json`
   - `MedChain.Staging.postman_environment.json`

### 2. Select Environment

- For local development: Select "Local Development" from the environment dropdown
- For testnet testing: Select "Testnet"
- For staging testing: Select "Staging"

### 3. Authentication Flow

The collection is designed to handle authentication automatically:

1. **Login**: Run the "Login" request in the Auth folder
   - This automatically stores the JWT token in collection variables
   - All subsequent requests will use this token via Bearer authentication

2. **Token Refresh**: If tokens expire, use the "Refresh Token" request
   - This updates the stored tokens automatically

### 4. Running Tests

The collection includes automated tests that run on each request:

- **Status Code Validation**: Ensures responses are not 5xx server errors
- **Response Time**: Validates responses complete in under 1000ms
- **Required Fields**: Checks for expected response structure

### 5. Collection Organization

Requests are organized into folders matching API modules:

- **Auth**: User registration, login, token management, MFA
- **Records**: Medical record CRUD operations, file uploads/downloads
- **Access Control**: Grant/revoke access, emergency access, access logs
- **Users**: User management, staff creation, license verification
- **Audit**: Audit log retrieval and export
- **FHIR**: FHIR R4 API endpoints for interoperability
- **Admin**: Administrative analytics and system metrics
- **GDPR**: Data subject rights (export, erasure, request status)

### 6. Example Usage Flow

1. **Register a Patient** (Auth folder)
2. **Login** with the registered credentials
3. **Upload a Medical Record** (Records folder)
4. **Grant Access** to a healthcare provider (Access Control folder)
5. **View Audit Logs** (Audit folder)
6. **Check System Analytics** (Admin folder)

### 7. Environment Variables

The collection uses these variables (automatically managed):

- `{{jwt_token}}`: Access token for API authentication
- `{{refresh_token}}`: Refresh token for token renewal
- `{{baseUrl}}`: API base URL (changes per environment)
- `{{test_patient_id}}`: Sample patient UUID
- `{{test_provider_id}}`: Sample provider UUID
- `{{test_record_id}}`: Sample record UUID

### 8. Troubleshooting

- **401 Unauthorized**: Ensure you've run the Login request first
- **403 Forbidden**: Check user permissions for admin-only endpoints
- **404 Not Found**: Verify UUIDs in test data exist
- **429 Too Many Requests**: Wait for rate limit reset
- **500 Server Error**: Check server logs and environment setup

### 9. Security Notes

- Never commit real credentials or tokens to version control
- Use test accounts only
- The collection includes example data only - replace with real test data as needed
- For production use, ensure proper authentication and authorization

### 10. Keeping Collection Updated

When the API changes:

1. Update the OpenAPI specification in `docs/openapi.json`
2. Regenerate the Postman collection from the OpenAPI spec
3. Update examples and test data as needed
4. Commit changes to maintain sync with API development

## Support

For issues with the API or this collection, please refer to the main project documentation or create an issue in the repository.