# OpenAPI Spec Regeneration

The `openapi.json` file in this directory is auto-generated from the NestJS
application's Swagger decorators. It was last generated when the API had only
9 documented paths.

## How to Regenerate

```bash
npm install
npm run docs:generate
```

This will run the export script at
`src/swaggeropenapi-documentation-with-full-schema-coverage/export-openapi.ts`
which bootstraps the NestJS app and writes the complete OpenAPI spec to
`docs/openapi.json`.

## Why It's Stale

The export script was never run after the API grew to 161+ controllers across
40+ domains (billing, laboratory, pharmacy, pathology, etc.). Running the
command above will capture all current endpoints.

See issue #782 for details.
