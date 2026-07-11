# Yhub Agent API Contract

## Base URL

https://yhub.net

All API responses are JSON.

## Agent Manifest

`GET /api/v1/agent-manifest`

This endpoint is public. Read it before deploying to detect stale installed skill copies.

Response: `200 OK`

```json
{
  "data": {
    "skill": {
      "name": "yhub-deploy-site",
      "latest_version": "1.1.0",
      "minimum_supported_version": "1.0.0",
      "download_url": "https://yhub.net/api/v1/agent-skills/yhub-deploy-site.zip"
    },
    "api": {
      "version": "v1",
      "base_url": "https://yhub.net/api/v1"
    },
    "sdk": {
      "version": "1.0.0",
      "browser_url": "https://yhub.net/sdk/v1/yhub.js",
      "esm_url": "https://yhub.net/sdk/v1/yhub.esm.js",
      "global": "yhub"
    },
    "features": {
      "inline_static_deploy": true,
      "json_file_deploy": true,
      "zip_bundle_deploy": true,
      "php_deploy": true,
      "managed_database_api": true,
      "javascript_sdk": true,
      "sqlite_file_deploy": false
    }
  }
}
```

If the installed skill is older than `minimum_supported_version`, stop and tell the user to update the skill from `download_url`.

## Download Current Skill

`GET /api/v1/agent-skills/yhub-deploy-site.zip`

This endpoint is public and returns the current `yhub-deploy-site` skill ZIP.

## Start Connect Agent Pairing

`POST /api/v1/agent-connections`

Request:

```json
{
  "agent_name": "Codex",
  "abilities": ["sites:read", "sites:create", "sites:deploy"]
}
```

`abilities` is optional. Default abilities:

```json
["sites:read", "sites:create", "sites:deploy"]
```

Allowed abilities:

```json
["sites:read", "sites:create", "sites:deploy", "sites:database", "sites:delete"]
```

Successful response: `201 Created`

```json
{
  "code": "opaque-code",
  "status": "pending",
  "agent_name": "Codex",
  "abilities": ["sites:read", "sites:create", "sites:deploy"],
  "connect_url": "https://yhub.net/agent/connect/opaque-code",
  "poll_url": "https://yhub.net/api/v1/agent-connections/opaque-code",
  "expires_at": "2026-06-04T10:30:00.000000Z"
}
```

## Poll Pairing Status

`GET /api/v1/agent-connections/{code}`

Use the bundled script instead of manual repeated `curl` calls:

```bash
node skills/yhub-deploy-site/scripts/wait-for-yhub-token.mjs "$POLL_URL"
```

The script prints progress to stderr and prints the final approved JSON, including `access_token`, to stdout. Exit codes:

- `0`: approved and token returned
- `2`: denied
- `3`: expired
- `4`: timeout
- `5`: approved token was already consumed

Possible statuses:

- `pending`
- `approved`
- `denied`
- `expired`

Before approval:

```json
{
  "code": "opaque-code",
  "status": "pending",
  "agent_name": "Codex",
  "abilities": ["sites:read", "sites:create", "sites:deploy"],
  "expires_at": "2026-06-04T10:30:00.000000Z",
  "approved_at": null,
  "denied_at": null
}
```

First poll after approval returns the token once:

```json
{
  "code": "opaque-code",
  "status": "approved",
  "token_type": "Bearer",
  "access_token": "plain-text-token"
}
```

Subsequent polls do not include `access_token`.

## Authenticated Requests

Send the token as:

```http
Authorization: Bearer <access_token>
Accept: application/json
Content-Type: application/json
```

## Create Site

`POST /api/v1/sites`

Required ability: `sites:create` or `sites:*`

Request:

```json
{
  "domain": "agent-demo",
  "custom_domain": null,
  "html": "<!doctype html><html><body><h1>Hello</h1></body></html>",
  "css": "body { font-family: system-ui; }",
  "js": "console.log('deployed')"
}
```

The JSON example above is the simple inline static path. For multi-file or PHP-backed deployments, send a `files` array instead of `html`, `css`, and `js`:

```json
{
  "domain": "agent-php-demo",
  "custom_domain": null,
  "files": [
    {
      "path": "index.php",
      "content": "<main><?php echo 'Hello from PHP'; ?></main>"
    },
    {
      "path": "assets/app.js",
      "content": "console.log('deployed')"
    },
    {
      "path": "assets/logo.png",
      "encoding": "base64",
      "content": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB..."
    }
  ]
}
```

Each file path must be relative and must not contain path traversal. Omit `encoding` for text content. Use `"encoding": "base64"` for binary assets such as images, fonts, media, WASM, and PDFs.

Supported file extensions include `.html`, `.htm`, `.css`, `.js`, `.mjs`, `.json`, `.map`, `.svg`, `.txt`, `.xml`, `.webmanifest`, `.php`, `.avif`, `.gif`, `.ico`, `.jpeg`, `.jpg`, `.png`, `.webp`, `.eot`, `.otf`, `.ttf`, `.woff`, `.woff2`, `.mp3`, `.mp4`, `.wav`, `.webm`, `.wasm`, and `.pdf`. SQLite, `.db`, and other database files are not supported through agent deployments; use the managed Database API instead.

Yhub hosting can run small PHP scripts when the deployment source includes PHP files, such as `index.php`, `contact.php`, or a small API handler. Use PHP for server-side secrets and private third-party API calls instead of exposing those values in `js`.

Yhub is static-first hosting with optional small PHP scripts. Deploy compiled frontend output and small self-contained PHP files. Do not assume support for full backend frameworks, Node/SSR runtimes, MySQL/PostgreSQL-style database servers, queues, daemons, schedulers, WebSockets, containers, shell access, package installation on the host, writable persistent storage, or custom web server configuration unless the API explicitly documents that support.

Response: `202 Accepted`

```json
{
  "data": {
    "id": 123,
    "domain": "agent-demo",
    "custom_domain": null,
    "effective_domain": "agent-demo.yhub.net",
    "url": "https://agent-demo.yhub.net",
    "status": {
      "code": 0,
      "label": "created",
      "error": null
    },
    "links": {
      "self": "https://yhub.net/api/v1/sites/123",
      "deployments": "https://yhub.net/api/v1/sites/123/deployments",
      "database": "https://yhub.net/api/v1/sites/123/database"
    }
  }
}
```

## Create Site From ZIP Bundle

`POST /api/v1/sites/bundles`

Required ability: `sites:create` or `sites:*`

Use `multipart/form-data`.

Fields:

- `domain`: optional subdomain.
- `custom_domain`: optional custom domain.
- `bundle`: required ZIP file, up to 100 MB.

The ZIP may contain files at the root or inside one top-level folder such as `dist/`; Yhub normalizes a single top-level folder automatically. The bundle must contain a top-level `index.html` or `index.php` after normalization.

Response: `202 Accepted`, same resource shape as create site.

## Show Site / Poll Deployment

`GET /api/v1/sites/{site}`

Required ability: `sites:read` or `sites:*`

Poll until:

- `data.status.label === "active"`: success
- `data.status.label === "error"`: failed; report `data.status.error`

## Update Existing Site

`POST /api/v1/sites/{site}/deployments`

Required ability: `sites:deploy` or `sites:*`

Request:

```json
{
  "html": "<main><h1>Updated</h1></main>",
  "css": "body { color: blue; }",
  "js": ""
}
```

Multi-file and PHP-backed updates use the same `files` array shape as site creation.

Response: `202 Accepted`, same resource shape as create site.

For PHP-backed updates, deploy a PHP-capable file payload. Keep PHP scripts small and self-contained. Do not deploy SQLite or other database files; use the managed Database API for lightweight data. If a feature needs unsupported runtime behavior, use static assets plus a small PHP handler, call an external managed service, or keep the backend outside Yhub.

## Update Existing Site From ZIP Bundle

`POST /api/v1/sites/{site}/deployments/bundle`

Required ability: `sites:deploy` or `sites:*`

Use `multipart/form-data` with required field `bundle`, a ZIP file up to 100 MB.

Response: `202 Accepted`, same resource shape as update site.

## Managed Database API

Use this when the user wants lightweight database-backed CRUD endpoints such as `/api/products`. Prefer this over hand-rolled PHP/SQLite for generic tables/entities.

Platform ability required: `sites:database` or `sites:*`

### Show Database Configuration

`GET /api/v1/sites/{site}/database`

Response: `200 OK` when enabled, `404 Not Found` when not enabled.

### Enable or Update Database Schema

`PUT /api/v1/sites/{site}/database`

Request:

```json
{
  "enabled": true,
  "auth_enabled": false,
  "schema": {
    "entities": [
      {
        "name": "products",
        "access": {
          "read": "server",
          "write": "server"
        },
        "fields": [
          { "name": "title", "type": "text", "required": true },
          { "name": "price", "type": "number" },
          { "name": "published", "type": "boolean" },
          { "name": "metadata", "type": "json" }
        ]
      }
    ]
  }
}
```

Supported field types:

```json
["text", "integer", "number", "boolean", "datetime", "json"]
```

Reserved field names:

```json
["id", "_user_id", "created_at", "updated_at"]
```

Reserved entity names:

```json
["auth"]
```

App-user authentication is optional. Set `auth_enabled` to `true` only when `/api/auth/*`, signed-in app users, or owner-scoped records are needed.

Recommended table presets:

- Private backend table: `read=server`, `write=server`
- Public read-only table: `read=public`, `write=server`
- Public table: `read=public`, `write=public`
- Signed-in users table: `read=authenticated`, `write=authenticated`, requires `auth_enabled=true`
- User-owned table: `read=owner`, `write=owner`, requires `auth_enabled=true`

Underlying entity `access` modes:

```json
{
  "read": "server",
  "write": "server"
}
```

Supported values:

- `server`: requires a `ydb_...` site runtime token.
- `public`: no bearer token required.
- `authenticated`: requires an app-user `yusr_...` token.
- `owner`: requires an app-user `yusr_...` token and automatically scopes rows by system field `_user_id`.

Use `owner` for per-user data. The customer must not define `_user_id`; the runtime creates and fills it. When auth is enabled, Yhub shows read-only system tables `_users` and `_user_tokens` in the UI.

Response: `202 Accepted`

```json
{
  "data": {
    "id": 456,
    "site_id": 123,
    "enabled": true,
    "auth_enabled": false,
    "schema": {
      "entities": [
        {
          "name": "products",
          "access": {
            "read": "server",
            "write": "server"
          },
          "fields": [
            { "name": "title", "type": "text", "required": true }
          ]
        }
      ]
    },
    "api_base_path": "/api",
    "api_tokens": []
  }
}
```

Enabling this feature forces the site onto PHP release runtime. If the site has no current release, deploy or redeploy it after enabling the database.

### Create Runtime Database Token

`POST /api/v1/sites/{site}/database/tokens`

Request:

```json
{
  "name": "Frontend app",
  "abilities": ["read", "write"]
}
```

Response: `201 Created`

```json
{
  "data": {
    "id": 789,
    "name": "Frontend app",
    "abilities": ["read", "write"],
    "last_used_at": null
  },
  "plain_text_token": "ydb_plain_text_token_returned_once"
}
```

The `plain_text_token` is returned once. Yhub stores only the token hash.

### Revoke Runtime Database Token

`DELETE /api/v1/sites/{site}/database/tokens/{token}`

Response: `204 No Content`

### Public Site Runtime API

For browser code, load the absolute `data.sdk.browser_url` returned by the agent manifest and use the SDK instead of writing these HTTP calls manually:

```html
<script src="https://yhub.net/sdk/v1/yhub.js"></script>
<script>
  const products = yhub.db.collection('products')
  const created = await products.create({ title: 'Demo' })
  const rows = await products.list({ limit: 20 })
</script>
```

The SDK defaults to the hosted site's current origin, discovers features through `GET /api/_meta`, stores `yusr_...` app-user tokens in `localStorage`, and sends `X-YHub-SDK-Version` on runtime calls. `YhubError` preserves the runtime's `status` and validation `errors`. Use the HTTP route details below for platform integration and debugging.

Use the `plain_text_token` from token creation against server-protected public site routes:

```http
Authorization: Bearer ydb_plain_text_token_returned_once
Accept: application/json
Content-Type: application/json
```

Routes:

- `GET /api`: list entity names.
- `POST /api/auth/register`: create app user when `auth_enabled=true`. Request JSON: `email`, `password`, optional `name`. Response includes `token` with prefix `yusr_` and `user`.
- `POST /api/auth/login`: create app-user session token when `auth_enabled=true`. Request JSON: `email`, `password`.
- `GET /api/auth/me`: return current app user when `auth_enabled=true`. Requires `Authorization: Bearer yusr_...`.
- `POST /api/auth/logout`: revoke current app-user token when `auth_enabled=true`.
- `GET /api/{entity}`: list records. Supports `limit` and `offset`.
- `POST /api/{entity}`: create record. Requires `write`.
- `GET /api/{entity}/{id}`: read one record.
- `PATCH /api/{entity}/{id}`: update provided fields. Requires `write`.
- `PUT /api/{entity}/{id}`: update record and require required fields. Requires `write`.
- `DELETE /api/{entity}/{id}`: delete record. Requires `write`.

For `authenticated` and `owner` entity access, use the `yusr_...` token returned by `/api/auth/register` or `/api/auth/login`:

```http
Authorization: Bearer yusr_plain_text_token
Accept: application/json
Content-Type: application/json
```

Owner-scoped rows are filtered by `_user_id`. Site runtime tokens (`ydb_...`) are server/admin tokens and bypass owner filtering.

## Delete Site

`DELETE /api/v1/sites/{site}`

Required ability: `sites:delete` or `sites:*`

Do not use this unless the user explicitly asks to delete the site and the token has deletion permission.

## Common Errors

- `401 Unauthorized`: reconnect to Yhub.
- `403 Forbidden`: token lacks ability; reconnect with required permission.
- `404 Not Found`: code or site does not exist, or the site does not belong to the user.
- `422 Unprocessable Entity`: validation failed. Show the field error.
