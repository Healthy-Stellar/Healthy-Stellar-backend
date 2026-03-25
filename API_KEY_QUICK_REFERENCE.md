# API Key Authentication - Quick Reference

## 🚀 Quick Start

### 1. Create an API Key

```bash
curl -X POST http://localhost:3000/admin/api-keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Hospital Integration",
    "description": "For hospital information system",
    "scopes": ["read:records", "write:records"]
  }'
```

Response includes the raw key (save it securely):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Hospital Integration",
  "scopes": ["read:records", "write:records"],
  "key": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6"
}
```

### 2. Use the API Key

```bash
curl -X GET http://localhost:3000/records \
  -H "X-API-Key: a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6"
```

### 3. Revoke an API Key

```bash
curl -X DELETE http://localhost:3000/admin/api-keys/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🔑 Available Scopes

| Scope | Permission | Use Case |
|-------|-----------|----------|
| `read:records` | Read medical records | Retrieve patient data |
| `write:records` | Create/update records | Add clinical notes |
| `read:patients` | Read patient info | List patients, demographics |

## 🛡️ Security Rules

1. **Key is returned ONLY once** - save it immediately
2. **Never commit keys to version control**
3. **Rotate keys regularly** (recommended: monthly)
4. **Use minimal scopes** - only request what you need
5. **Monitor usage** - check last_used_at and last_used_by_ip
6. **Revoke immediately** if compromised

## 📊 Rate Limits

- **API Keys**: 50 requests/minute per key
- **JWT Users**: 100 requests/minute per user

Headers returned with each response:
```
X-RateLimit-Limit: 50
X-RateLimit-Remaining: 49
X-RateLimit-Reset: 1711270860
```

## 🔍 List API Keys

```bash
curl -X GET http://localhost:3000/admin/api-keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Response:
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Hospital Integration",
    "description": "For hospital information system",
    "scopes": ["read:records", "write:records"],
    "isActive": true,
    "createdAt": "2026-03-24T12:00:00Z",
    "lastUsedAt": "2026-03-24T13:30:45Z",
    "lastUsedByIp": "192.168.1.100",
    "createdBy": {
      "id": "user-id",
      "email": "admin@hospital.com",
      "firstName": "Admin",
      "lastName": "User"
    }
  }
]
```

## 💻 Implementation in Your Application

### JavaScript/Node.js

```javascript
const apiKey = 'a1b2c3d4e5f6...';

const response = await fetch('http://localhost:3000/records', {
  headers: {
    'X-API-Key': apiKey
  }
});
```

### Python

```python
import requests

api_key = 'a1b2c3d4e5f6...'
headers = {'X-API-Key': api_key}

response = requests.get('http://localhost:3000/records', headers=headers)
```

### cURL

```bash
curl http://localhost:3000/records \
  -H "X-API-Key: a1b2c3d4e5f6..."
```

## ⚠️ Common Errors

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Invalid or inactive API key"
}
```
**Solution**: Check key spelling, ensure key is active (not revoked)

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "API key does not have required scope"
}
```
**Solution**: Create new key with required scopes or use accounts with proper permissions

### 429 Too Many Requests
```json
{
  "message": "API key rate limit exceeded"
}
```
**Solution**: Check `Retry-After` header, implement exponential backoff

### Header not found
```json
{
  "statusCode": 401,
  "message": "No API key provided"
}
```
**Solution**: Ensure `X-API-Key` header is included in request

## 🧪 Testing with Postman

1. Create an environment variable:
   - Variable: `API_KEY`
   - Value: Your 64-character hex key

2. In request headers:
   ```
   X-API-Key: {{API_KEY}}
   ```

3. Example request:
   ```
   GET http://localhost:3000/records
   Headers: X-API-Key: {{API_KEY}}
   ```

## 📈 Monitoring

### Check Last Usage
```bash
curl http://localhost:3000/admin/api-keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" | jq '.[] | {name, lastUsedAt, lastUsedByIp}'
```

### Audit Trail
All API key operations are logged in audit logs:
- API key creation
- API key revocation
- Access attempts

## 🔄 Key Rotation Best Practices

1. **Create new key** with same scopes
2. **Update application** to use new key
3. **Monitor** that new key is being used
4. **Revoke old key** after confirmation
5. **Keep 1-2 old keys active** for 24-48 hours as backup

## 📚 Full Documentation

See [api-key-authentication.md](docs/api-key-authentication.md) for complete documentation including:
- Architecture overview
- Database schema
- Error handling
- Troubleshooting
- Security features

## ❓ FAQ

**Q: Can I see the raw key after creation?**
A: No, raw keys are returned only once. Save it securely immediately.

**Q: What if I lose my key?**
A: Revoke it and create a new one.

**Q: Can API keys access everything?**
A: No, they're limited by assigned scopes.

**Q: Do API keys expire?**
A: No, they're perpetual until revoked. Implement rotation policy.

**Q: Can I have multiple API keys?**
A: Yes, create as many as needed.

**Q: Are API keys tracked?**
A: Yes, usage is audited and tracked.