# NestJS — Full Swagger / OpenAPI Setup

Complete implementation of `@nestjs/swagger` meeting every acceptance criterion.

---

## Acceptance Criteria Checklist

| # | Requirement | Where |
|---|-------------|-------|
| ✅ | `@nestjs/swagger` configured in `main.ts` with title, version, description, bearer auth | `src/main.ts` |
| ✅ | Swagger UI at `/api/docs` (non-production only) | `src/main.ts` |
| ✅ | Every controller method: `@ApiOperation`, `@ApiResponse`, `@ApiBearerAuth` | `src/auth/auth.controller.ts`, `src/users/users.controller.ts` |
| ✅ | All DTOs: `@ApiProperty` with `type`, `example`, `description` | `src/users/dto/user.dto.ts`, `src/auth/dto/auth.dto.ts` |
| ✅ | Error responses 400/401/403/404/500 on every endpoint | `src/common/decorators/api-endpoint.decorator.ts` |
| ✅ | OpenAPI JSON exported to `/docs/openapi.json` on build | `scripts/export-openapi.ts` + `postbuild` script |
| ✅ | Swagger UI protected by basic auth in staging | `src/main.ts` (staging block) |

---

## Quick Start

```bash
npm install
npm run start:dev
# → http://localhost:3000/api/docs
```

---

## Project Structure

```
src/
├── main.ts                              # Swagger bootstrap
├── app.module.ts
├── auth/
│   ├── auth.controller.ts              # @ApiOperation, @ApiResponse per method
│   └── dto/auth.dto.ts                 # @ApiProperty on every field
├── users/
│   ├── users.controller.ts             # Full CRUD with error docs
│   └── dto/user.dto.ts                 # CreateUserDto, UpdateUserDto, UserDto
└── common/
    ├── decorators/
    │   ├── api-endpoint.decorator.ts   # ← Reusable combined decorator
    │   └── api-property.decorator.ts   # Typed @Prop shorthand
    └── dto/
        ├── error-response.dto.ts       # Shared 4xx/5xx schema
        └── paginated.dto.ts            # Generic paginated wrapper

scripts/
└── export-openapi.ts                   # Writes docs/openapi.json

docs/
└── openapi.json                        # Auto-generated (gitignore or commit)
```

---

## Key Patterns

### 1. `@ApiEndpoint` — Reusable Composite Decorator

Instead of pasting 8 decorators on every method, use the single composite:

```ts
@ApiEndpoint({
  summary: 'List all users',
  description: 'Returns a paginated list. Requires admin/editor role.',
  operationId: 'listUsers',
  type: PaginatedUserDto,
})
findAll(@Query() query: UserQueryDto) { … }
```

This automatically applies:
- `@ApiOperation`
- `@ApiBearerAuth('access-token')`
- `@ApiResponse` for **200** (success)
- `@ApiResponse` for **400, 401, 403, 404, 500** (errors)

### 2. DTOs with `@ApiProperty`

Every field carries `example`, `description`, and type constraints:

```ts
@ApiProperty({
  example: 'jane.doe@example.com',
  description: 'Unique email address',
  format: 'email',
})
@IsEmail()
email: string;
```

Use `@ApiPropertyOptional` for non-required fields. Use `PartialType(SomeDto)` for update DTOs — all `@ApiProperty` metadata is inherited automatically.

### 3. Bearer Auth

```ts
// main.ts — register the scheme once
.addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')

// Controller or method — reference it
@ApiBearerAuth('access-token')
```

The **Authorize** button in Swagger UI will prompt for the token.

### 4. Generate OpenAPI JSON

```bash
# standalone script (no running server needed)
npm run docs:generate

# also runs automatically after every build:
npm run build   # → runs postbuild → writes docs/openapi.json
```

### 5. Staging Basic Auth

Set environment variables before starting:

```bash
NODE_ENV=staging \
SWAGGER_USER=devteam \
SWAGGER_PASS=s3cr3t \
npm start
```

The `/api/docs` and `/api/docs-json` routes will return HTTP 401 until valid credentials are provided.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | `production` hides Swagger entirely; `staging` enables basic auth |
| `SWAGGER_USER` | `admin` | Staging basic auth username |
| `SWAGGER_PASS` | `secret` | Staging basic auth password |

---

## Extending

**New controller** — annotate with `@ApiTags('my-tag')` and use `@ApiEndpoint` on each method.

**New DTO** — add `@ApiProperty` (with `example` + `description`) to every field.

**Custom error code** — add an extra `@ApiResponse` alongside `@ApiEndpoint`:

```ts
@ApiEndpoint({ summary: '…', type: SomeDto })
@ApiResponse({ status: 409, description: 'Email already taken.', type: ErrorResponseDto })
create(@Body() dto: CreateUserDto) { … }
```
