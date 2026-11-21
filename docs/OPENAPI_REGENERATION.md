# OpenAPI Spec Regeneration

The `openapi.json` file in this directory is generated from the NestJS
application's Swagger decorators. It currently contains only 9 documented
paths, so it is not yet a complete reference. Regeneration is gated on a green
application build; known build failures are tracked in issues #1011–#1036.

## How to Regenerate

```bash
pnpm install --frozen-lockfile
pnpm run build
pnpm run docs:generate
```

This will run the export script at
`src/swaggeropenapi-documentation-with-full-schema-coverage/export-openapi.ts`
which bootstraps the NestJS app and writes the complete OpenAPI spec to
`docs/openapi.json`. Review the generated paths and schemas before committing.

## Drift Check

CI builds the app, regenerates the spec, and fails if regeneration changes the
committed `docs/openapi.json`. Run the same check locally with:

```bash
pnpm run docs:check
```

## Postman Collection

After regenerating and reviewing the OpenAPI spec, regenerate the collection
with `openapi-to-postmanv2`:

```bash
npx --yes openapi-to-postmanv2 \
	-s docs/openapi.json \
	-o docs/postman/MedChain.postman_collection.json \
	-p
```

Commit the resulting collection alongside the spec. The environment files in
`docs/postman/` are maintained separately and are not replaced by this command.
