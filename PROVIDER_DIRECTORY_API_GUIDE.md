# Provider Directory Search API - Quick Reference

## Endpoint
```
GET /providers
```

## Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `search` | string | No | - | Full-text search across name, institution, specialty |
| `specialty` | string | No | - | Filter by specialty (case-insensitive partial match) |
| `role` | enum | No | - | Filter by role: `doctor`, `lab`, or `insurer` |
| `page` | number | No | 1 | Page number (min: 1) |
| `limit` | number | No | 20 | Results per page (min: 1, max: 100) |

## Authentication
- **Optional:** Endpoint works with or without authentication
- **Authenticated:** Include `Authorization: Bearer <token>` header
- **Benefit:** Authenticated requests receive `stellarPublicKey` in response

## Rate Limiting
- **Limit:** 30 requests per minute
- **Tracking:** By IP address and authenticated user
- **Response:** HTTP 429 when limit exceeded

## Response Format

### Success (200 OK)
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "displayName": "Dr. Sarah Johnson",
      "role": "doctor",
      "specialty": "Cardiology",
      "institution": "General Hospital",
      "stellarPublicKey": "GABC123..." // Only if authenticated
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45
  }
}
```

### Error Responses

**400 Bad Request** - Invalid parameters
```json
{
  "statusCode": 400,
  "message": ["page must be a positive number"],
  "error": "Bad Request"
}
```

**401 Unauthorized** - Invalid token
```json
{
  "statusCode": 401,
  "message": "Invalid or expired token",
  "error": "Unauthorized"
}
```

**429 Too Many Requests** - Rate limit exceeded
```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests",
  "error": "Too Many Requests"
}
```

## Usage Examples

### 1. Basic Search (Unauthenticated)
```bash
curl -X GET "http://localhost:3000/providers?search=cardiology"
```

### 2. Search with Pagination
```bash
curl -X GET "http://localhost:3000/providers?search=hospital&page=2&limit=10"
```

### 3. Filter by Role
```bash
curl -X GET "http://localhost:3000/providers?role=doctor&specialty=Cardiology"
```

### 4. Authenticated Request (includes stellarPublicKey)
```bash
curl -X GET "http://localhost:3000/providers?search=clinic" \
  -H "Authorization: Bearer eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9..."
```

### 5. Filter by Specialty
```bash
curl -X GET "http://localhost:3000/providers?specialty=Neurology&page=1&limit=50"
```

### 6. List All Providers (Paginated)
```bash
curl -X GET "http://localhost:3000/providers?page=1&limit=20"
```

## JavaScript/TypeScript Examples

### Using Fetch API
```typescript
async function searchProviders(searchTerm: string, token?: string) {
  const url = new URL('http://localhost:3000/providers');
  url.searchParams.append('search', searchTerm);
  url.searchParams.append('page', '1');
  url.searchParams.append('limit', '20');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url.toString(), { headers });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

// Usage
const results = await searchProviders('cardiology', 'your-jwt-token');
console.log(`Found ${results.pagination.total} providers`);
```

### Using Axios
```typescript
import axios from 'axios';

async function searchProviders(params: {
  search?: string;
  specialty?: string;
  role?: 'doctor' | 'lab' | 'insurer';
  page?: number;
  limit?: number;
}, token?: string) {
  const config = {
    params,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  };

  const response = await axios.get('http://localhost:3000/providers', config);
  return response.data;
}

// Usage
const results = await searchProviders({
  search: 'cardiology',
  role: 'doctor',
  page: 1,
  limit: 20
}, 'your-jwt-token');
```

## React Hook Example
```typescript
import { useState, useEffect } from 'react';

interface Provider {
  id: string;
  displayName: string;
  role: 'doctor' | 'lab' | 'insurer';
  specialty: string | null;
  institution: string | null;
  stellarPublicKey?: string | null;
}

interface ProviderSearchResult {
  data: Provider[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

function useProviderSearch(searchTerm: string, token?: string) {
  const [data, setData] = useState<ProviderSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!searchTerm) return;

    const fetchProviders = async () => {
      setLoading(true);
      setError(null);

      try {
        const url = new URL('http://localhost:3000/providers');
        url.searchParams.append('search', searchTerm);

        const headers: HeadersInit = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(url.toString(), { headers });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchProviders();
  }, [searchTerm, token]);

  return { data, loading, error };
}

// Usage in component
function ProviderSearch() {
  const [search, setSearch] = useState('');
  const { data, loading, error } = useProviderSearch(search, 'your-token');

  return (
    <div>
      <input 
        value={search} 
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search providers..."
      />
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error.message}</p>}
      {data && (
        <div>
          <p>Found {data.pagination.total} providers</p>
          <ul>
            {data.data.map(provider => (
              <li key={provider.id}>
                {provider.displayName} - {provider.specialty}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

## Search Tips

### Full-Text Search Features
- **Case-insensitive:** Search is not case-sensitive
- **Partial matching:** Searches for words within text
- **Multiple fields:** Searches across displayName, institution, specialty
- **Relevance ranking:** Results sorted by relevance score when searching

### Search Examples
- `"cardiology"` - Finds all providers with cardiology in any field
- `"general hospital"` - Finds providers at General Hospital
- `"dr smith"` - Finds providers named Dr. Smith
- `"neuro"` - Finds neurology, neurosurgeon, etc.

## Role Mapping

| API Role | Description | Examples |
|----------|-------------|----------|
| `doctor` | Physicians and medical doctors | General practitioners, specialists, surgeons |
| `lab` | Laboratory and medical records staff | Lab technicians, pathologists |
| `insurer` | Billing and insurance staff | Insurance coordinators, billing specialists |

## Best Practices

1. **Pagination:** Always use pagination for large result sets
2. **Rate Limiting:** Implement client-side throttling to avoid hitting rate limits
3. **Authentication:** Use authenticated requests when you need stellarPublicKey
4. **Error Handling:** Always handle 401, 429, and network errors
5. **Caching:** Consider caching results client-side to reduce API calls
6. **Debouncing:** Debounce search input to avoid excessive API calls

## Testing

### Test with cURL
```bash
# Test basic search
curl -X GET "http://localhost:3000/providers?search=test"

# Test rate limiting (run 31 times quickly)
for i in {1..31}; do
  curl -X GET "http://localhost:3000/providers"
done

# Test authentication
curl -X GET "http://localhost:3000/providers" \
  -H "Authorization: Bearer invalid-token"
```

### Test with Postman
1. Create a new GET request to `http://localhost:3000/providers`
2. Add query parameters in the Params tab
3. For authenticated requests, add Authorization header with Bearer token
4. Send request and verify response structure

## Performance Considerations

- **Index Usage:** Full-text search uses GIN index for fast queries
- **Pagination:** Use appropriate page sizes (20-50 recommended)
- **Caching:** Results can be cached client-side for 5-10 minutes
- **Rate Limiting:** 30 requests/min should be sufficient for most use cases

## Security Notes

- `stellarPublicKey` is only exposed to authenticated users
- Rate limiting prevents enumeration attacks
- All inputs are validated and sanitized
- SQL injection protection via parameterized queries
- Session validation for authenticated requests

## Support

For issues or questions:
- Check the implementation docs: `PROVIDER_DIRECTORY_IMPLEMENTATION.md`
- Review unit tests: `src/auth/services/provider-directory.service.spec.ts`
- Review E2E tests: `test/e2e/providers-directory.e2e-spec.ts`
