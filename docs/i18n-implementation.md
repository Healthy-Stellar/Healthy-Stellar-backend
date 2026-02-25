# Internationalization (i18n) Implementation Guide

## Overview

MedChain implements comprehensive internationalization support for 4 languages:
- **English (en)** - Default
- **French (fr)**
- **Spanish (es)**
- **Arabic (ar)** - Full RTL support

## Architecture

### Translation Files Structure

```
src/i18n/
├── locales/
│   ├── en.json       # 157 keys organized in 10 categories
│   ├── fr.json       # French translations
│   ├── es.json       # Spanish translations
│   └── ar.json       # Arabic translations
├── i18n.service.ts   # Translation service
├── i18n.controller.ts # REST endpoints
├── i18n.module.ts    # NestJS module
├── pipes/
│   └── i18n-validation.pipe.ts  # Validation error translation
└── filters/
    └── i18n-exception.filter.ts # Exception message translation
```

### Email Templates

All email templates are localized with per-language variants:

```
src/email-templates/i18n/
├── access-granted.en.hbs
├── access-granted.fr.hbs
├── access-granted.es.hbs
├── access-granted.ar.hbs
├── verify-email.en.hbs
├── verify-email.fr.hbs
├── verify-email.es.hbs
├── verify-email.ar.hbs
├── reset-password.en.hbs
├── reset-password.fr.hbs
├── reset-password.es.hbs
└── reset-password.ar.hbs
```

## Translation Keys Organization

### 1. Common (16 keys)
Basic UI strings: error, success, warning, loading, confirm, save, delete, edit, etc.

```json
{
  "common": {
    "error": "An error occurred",
    "success": "Operation completed successfully",
    "loading": "Loading...",
    ...
  }
}
```

### 2. Authentication (24 keys)
Login, register, password, email verification messages.

```json
{
  "auth": {
    "loginSuccess": "Successfully logged in",
    "invalidCredentials": "Invalid email or password",
    "emailAlreadyExists": "This email is already registered",
    "passwordTooWeak": "Password must contain at least 12 characters...",
    ...
  }
}
```

### 3. Validation (12 keys)
Form validation error messages with variable interpolation.

```json
{
  "validation": {
    "required": "This field is required",
    "email": "Please enter a valid email address",
    "minLength": "Must be at least {{min}} characters long",
    "maxLength": "Must not exceed {{max}} characters",
    ...
  }
}
```

### 4. Records (13 keys)
Medical records CRUD operations and access control.

### 5. Access (13 keys)
Access grants, permissions, and authorization messages.

### 6. Users (11 keys)
User management and profile related messages.

### 7. Errors (14 keys)
HTTP error responses and system errors.

### 8. Email (11 keys)
Email notification messages.

### 9. Pagination (5 keys)
Pagination related UI text.

### 10. Status (9 keys)
Status indicators: active, inactive, pending, completed, etc.

## Usage

### I18nService

The `I18nService` provides translation utilities:

```typescript
import { I18nService } from './i18n/i18n.service';

@Injectable()
export class MyService {
  constructor(private i18n: I18nService) {}

  doSomething() {
    // Simple translation
    const message = this.i18n.translate('auth.loginSuccess');
    
    // With variables
    const errorMsg = this.i18n.translate('validation.minLength', { min: 12 });
    
    // Get current language
    const lang = this.i18n.getCurrentLanguage();
    
    // Check supported languages
    const isSupported = this.i18n.isLanguageSupported('fr');
  }
}
```

### In Controllers

```typescript
import { Controller, Get } from '@nestjs/common';
import { I18nService } from './i18n/i18n.service';

@Controller('records')
export class RecordsController {
  constructor(private i18n: I18nService) {}

  @Get()
  getRecords() {
    // Errors use i18n automatically through exception filter
    throw new BadRequestException('recordAtAccessDenied');
  }
}
```

### Validation Errors

The custom `I18nValidationPipe` automatically translates validation errors:

```typescript
@Controller('auth')
export class AuthController {
  @Post('register')
  @UsePipes(I18nValidationPipe)
  async register(@Body() dto: RegisterDto) {
    // Validation errors are automatically translated
    // Example error response:
    // {
    //   "email": "Please enter a valid email address",
    //   "password": "Must be at least 12 characters long"
    // }
  }
}
```

### Exception Handling

The `I18nExceptionFilter` automatically translates HTTP exception messages:

```typescript
// Throws translated error based on current language
throw new BadRequestException('emailAlreadyExists');
// Response: "This email is already registered" (translated to user's language)
```

### Email Templates

Email sending with language-aware templates:

```typescript
// Automatically selects the correct template variant based on user's language
await this.emailService.send({
  to: user.email,
  template: 'verify-email',
  language: user.preferredLanguage || 'en', // Falls back to English
  context: {
    userName: user.name,
    verificationCode: code,
    verificationLink: link,
  },
});
```

## Language Resolution

Language is determined in the following order:

1. **Request Header**: `Accept-Language` HTTP header (standard)
   ```
   Accept-Language: fr-FR,fr;q=0.9,en;q=0.8
   ```

2. **User Preference**: User's stored language preference

3. **Default**: English (en)

### Accept-Language Parsing

The system parses quality factors correctly:

```
Accept-Language: en-US,en;q=0.9,fr;q=0.8,es;q=0.7
// Resolved to: 'en' (quality 1.0)

Accept-Language: fr;q=0.9,en;q=0.8
// Resolved to: 'fr' (quality 0.9)

Accept-Language: ar,en;q=0.5
// Resolved to: 'ar' (quality 1.0, fully supported)
```

## REST Endpoints

### GET /i18n/supported-languages
Returns list of supported languages.

```json
{
  "languages": ["en", "fr", "es", "ar"],
  "default": "en"
}
```

### GET /i18n/current-language
Returns the current language from request context.

```json
{
  "language": "en"
}
```

### GET /i18n/test-translation?key=auth.loginSuccess
Test translation of a specific key.

```json
{
  "key": "auth.loginSuccess",
  "translation": "Successfully logged in",
  "language": "en"
}
```

### GET /i18n/language-info
Get detailed language information.

```json
{
  "currentLanguage": "en",
  "supportedLanguages": ["en", "fr", "es", "ar"],
  "isSupported": true
}
```

### GET /i18n/health
Health check for i18n service.

```json
{
  "status": "healthy",
  "service": "i18n",
  "supportedLanguages": 4,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Validation & Quality Assurance

### Translation Coverage Check

Run the validation script to ensure all languages have complete coverage:

```bash
node scripts/check-translation-coverage.js
```

**Validates:**
- ✅ All languages have the same number of translation keys
- ✅ No missing translations compared to English
- ✅ No extra/orphaned keys
- ✅ No empty translation values
- ✅ All email templates have variants for all languages
- ✅ Valid JSON syntax in all translation files

### CI/CD Integration

The GitHub Actions workflow `.github/workflows/i18n-coverage.yml` automatically:

1. **Checks translation coverage** on PR/push to main branches
2. **Validates JSON syntax** of all translation files
3. **Detects XSS patterns** in translations
4. **Verifies email templates** completeness
5. **Comments on PRs** with translation statistics
6. **Uploads coverage reports** as artifacts

### Pre-commit Hook (Optional)

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/bash
node scripts/check-translation-coverage.js
if [ $? -ne 0 ]; then
  echo "Translation coverage check failed!"
  exit 1
fi
```

## Best Practices

### 1. Organizing Translation Keys

- Use dot notation for hierarchical organization
- Keep related keys in the same category
- Use camelCase for compound words

```json
{
  "auth": {
    "loginSuccess": "Translation here",
    "emailAlreadyExists": "Translation here"
  }
}
```

### 2. Interpolation Variables

Use double braces `{{variable}}` for template variables:

```json
{
  "validation": {
    "minLength": "Must be at least {{min}} characters long"
  }
}
```

Usage:
```typescript
this.i18n.translate('validation.minLength', { min: 12 });
// Result: "Must be at least 12 characters long"
```

### 3. Email Templates

Always include all necessary context variables:

```handlebars
<h1>Welcome {{userName}}!</h1>
<p>Your access level: {{accessLevel}}</p>
{{#if expiresAt}}
<p>This access expires on {{expiresAt}}</p>
{{/if}}
```

### 4. Testing Translations

Create test cases for critical translations:

```typescript
it('should translate auth.loginSuccess', () => {
  const translation = i18nService.translate('auth.loginSuccess');
  expect(translation).toBe('Successfully logged in');
});

it('should interpolate variables', () => {
  const translation = i18nService.translate('validation.minLength', { min: 12 });
  expect(translation).toContain('12');
});
```

## Adding New Languages

To add a new language (e.g., German - de):

1. **Create translation file:**
   ```bash
   cp src/i18n/locales/en.json src/i18n/locales/de.json
   ```

2. **Update translations** in `de.json`

3. **Add to i18n.service.ts:**
   ```typescript
   getSupportedLanguages(): string[] {
     return ['en', 'fr', 'es', 'ar', 'de']; // Add 'de'
   }
   ```

4. **Create email templates:**
   ```bash
   for template in access-granted verify-email reset-password; do
     cp src/email-templates/i18n/$template.en.hbs \
        src/email-templates/i18n/$template.de.hbs
   done
   ```

5. **Run validation:**
   ```bash
   node scripts/check-translation-coverage.js
   ```

## Performance Considerations

- **Lazy loading**: Translation files are loaded once at startup
- **Caching**: nestjs-i18n caches translations in memory
- **No runtime parsing**: JSON files pre-parsed at module initialization
- **Minimal overhead**: I18nService adds <1ms to request processing

## Troubleshooting

### Missing Translation
If a key cannot be found:
- Returns the key itself as fallback (e.g., 'auth.missingKey')
- Check translation file exists and contains the key
- Run `node scripts/check-translation-coverage.js`

### Wrong Language Detected
- Check `Accept-Language` header in request
- Verify language code is in supported list
- Use `/i18n/current-language` endpoint to debug

### Email Template Not Found
- Verify file exists: `src/email-templates/i18n/{template}.{lang}.hbs`
- Check filename case sensitivity
- Run validation script to verify templates

## Related Documentation

- [NestJS i18n Module](https://nestjs-i18n.com/)
- [Handlebars Documentation](https://handlebarsjs.com/)
- [Accept-Language Header RFC](https://tools.ietf.org/html/rfc7231#section-5.3.5)
- [Data Residency Controls Documentation](./docs/data-residency.md)
