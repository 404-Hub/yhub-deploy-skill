---
name: yhub-deploy-site
description: Use when the user wants an AI agent to connect to Yhub and deploy, publish, update, or check a hosted site. Covers Connect Agent pairing, static and built frontends, small PHP scripts, the YHub PHP SDK, managed Database API endpoints, managed Telegram bots, Scheduled Functions, deployment polling, and status reporting.
---

# Yhub deploy site

Current skill version: `1.4.0`.

Use this skill to publish websites to Yhub through the agent API. Yhub is static-first hosting with optional small PHP scripts; it is not a general application runtime. The user should not need to copy API headers or manually create tokens.

## Core flow

1. Read `GET /api/v1/agent-manifest` and warn the user if this installed skill is below `minimum_supported_version`.
2. If no Yhub Bearer token is available, start Connect Agent pairing.
3. Show the returned `connect_url` to the user and ask them to open it.
4. Start the bundled polling script for `poll_url`; do not make the language model reason between polling attempts.
5. Store the returned Bearer token for the current session.
6. Create or update the site with production-ready files: static `html`/`css`/`js`, `files`, a ZIP `bundle`, or small PHP scripts when server-side logic is needed.
7. Poll the site resource until `status.label` is `active` or `error`.
8. If the user needs managed database-backed endpoints, enable the Database API for the site and use the hosted YHub JavaScript SDK in browser code. Create a runtime API token only for server-protected access that will remain outside public browser code.
9. If the user wants a Telegram bot, deploy the YHub PHP SDK and a managed webhook handler, then direct the user to connect the BotFather token in the site's Telegram settings. Read [references/php-sdk-telegram.md](references/php-sdk-telegram.md) before building or changing that handler.
10. If the site needs time-based work, deploy `scheduled.php`, request `sites:schedules`, then create and verify the schedule. Read [references/scheduled-functions.md](references/scheduled-functions.md) before building the handler.
11. If the site is a Telegram Mini App, read [references/telegram-mini-apps.md](references/telegram-mini-apps.md) before configuring auth or browser code.
12. Return the published `url` to the user.

For exact endpoints and response shapes, read [references/api-contract.md](references/api-contract.md).

## Hosting limits

Design for Yhub's current hosting model before building:

- Yhub can deploy static frontends: HTML, compiled CSS, browser JavaScript, images, fonts, and other static assets.
- Frontend frameworks are supported only after they are built into static output. Build React, Vue, Svelte, Astro, Vite, or similar projects first, then deploy the generated files.
- PHP support is for small, self-contained scripts such as `index.php`, `contact.php`, `api.php`, `webhook.php`, or simple form/API handlers.
- PHP is appropriate for private API calls, secret-bearing logic, webhooks, simple routing, and small server-rendered responses.
- PHP scripts should avoid framework bootstraps, large dependency trees, complex autoloaders, migration runners, queues, daemons, workers, WebSockets, self-managed cron-like loops, or long-running processes. Use Yhub-managed Scheduled Functions for short time-based work.
- Do not deploy SQLite, `.db`, or other database files. Use Yhub's managed Database API for lightweight persistent data.
- Prefer Yhub's managed Database API over hand-rolled PHP/SQLite when the user wants generic CRUD endpoints such as `/api/products`, `/api/posts`, or `/api/orders`.
- Do not deploy Laravel, Symfony, WordPress, Node/Express, Next.js server rendering, Python, Ruby, Go, MySQL/PostgreSQL-style database servers, Redis, background workers, containers, or server processes unless Yhub explicitly adds support for that runtime.
- Do not assume writable persistent storage, shell access, package installation on the host, process managers, custom web server configuration, or environment variable management unless the API contract explicitly exposes it.
- If a requested feature needs unsupported runtime behavior, propose a static/PHP-compatible design, an external managed service, or ask the user to deploy that backend elsewhere.

## Pairing

- Never ask the user to paste a token unless the pairing flow is unavailable.
- Show the `connect_url` plainly and tell the user it expires in 15 minutes.
- Use `scripts/wait-for-yhub-token.mjs` to wait for approval in one tool call:

```bash
node skills/yhub-deploy-site/scripts/wait-for-yhub-token.mjs "$POLL_URL"
```

- The script polls every 3 seconds by default and times out after 15 minutes.
- Do not run repeated manual `curl` calls through the model while waiting for approval.
- If status is `denied`, stop and tell the user the connection was cancelled.
- If status is `expired`, start a new pairing session if the user still wants to continue.
- The `access_token` is returned only once. Capture it immediately.
- If the task includes enabling or managing Yhub's Database API, request `sites:database` in addition to the normal deployment abilities. Do not request it for ordinary static deployments.
- If the task includes creating, updating, running, or reading Scheduled Functions, request `sites:schedules`. Do not request it for ordinary deployments.

## Deployments

- For simple static pages, send inline `html`, `css`, and `js`.
- For multi-file, built frontend, or PHP-backed sites, send a `files` array of `{ "path": "...", "content": "...", "encoding": "text|base64" }` objects. Paths must be relative and must not contain traversal. Omit `encoding` for text files; use `base64` for binary assets.
- For larger built sites, prefer a multipart ZIP bundle: `POST /api/v1/sites/bundles` for create and `POST /api/v1/sites/{site}/deployments/bundle` for updates. Put the built output at the ZIP root or inside one top-level directory.
- Use `POST /api/v1/sites` for a new site.
- Use `POST /api/v1/sites/{site}/deployments` to update an existing site.
- Prefer subdomains unless the user explicitly provides a supported custom domain.
- Do not request `sites:delete` by default.
- Do not request `sites:database` by default; request it only when the user needs managed storage, CRUD endpoints, table/entity setup, or Database API tokens.
- Do not request `sites:schedules` by default; request it only when the user needs time-based events or schedule management.
- Treat `202 Accepted` as queued, not completed.
- Poll `GET /api/v1/sites/{id}` until the site is `active` or `error`.
- If a site needs API keys, private tokens, webhooks, or other secrets, do not expose them in browser JavaScript. Put that logic in a PHP script and keep client-side code calling the PHP endpoint.
- Never place Yhub access tokens, Database API runtime tokens, or third-party secrets in files deployed to public browser code.
- Do not send SQLite, `.db`, or other database files in `files`; configure the managed Database API instead.
- For a YHub-hosted Telegram bot, use the one-file PHP SDK distribution and `Bot::serveFromYhub()`. Do not deploy a Composer `vendor/` tree just for the SDK.
- Never put a BotFather token or Telegram webhook secret in deployed files. YHub stores both outside the web root after the user connects the bot in the site's Telegram settings.
- `/tg_webhook` is a reserved URL managed by YHub. Deploy `telegram.php`, or use `index.php` as a fallback, but do not create a `tg_webhook` file or register a second webhook yourself.
- For Scheduled Functions, deploy only the user handler `scheduled.php`. Yhub owns the signed runtime gateway and its credential; never deploy that credential, `_yhub_schedule.php`, or a browser-side scheduler.

## Managed Scheduled Functions

Use Scheduled Functions for short named events that Yhub triggers from a cron expression. Required platform ability: `sites:schedules` or `sites:*`.

The safe order is:

1. Read [references/scheduled-functions.md](references/scheduled-functions.md).
2. Deploy a callable `scheduled.php` handler that treats `run_id` as its idempotency key.
3. Wait until the deployment is active.
4. Create the schedule through `POST /api/v1/sites/{site}/schedules`.
5. Use run-now only as a handler smoke test. Confirm automation from run history where `source` is `scheduled`.

The handler receives verified event data, never the signing credential. Do not add a secret field to deployment payloads, browser JavaScript, schedule requests, or logs.

## Managed Database API

Use Yhub's managed Database API when the user asks for database-backed CRUD endpoints and does not need custom backend logic. This creates a per-site SQLite database in the site's persistent runtime storage and exposes native entity routes under the public site URL.

Required platform ability:

- `sites:database` or `sites:*`

Enable or update the database schema:

```http
PUT /api/v1/sites/{site}/database
Authorization: Bearer <yhub_access_token>
Content-Type: application/json
```

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
          { "name": "published", "type": "boolean" }
        ]
      }
    ]
  }
}
```

Supported field types:

- `text`
- `integer`
- `number`
- `boolean`
- `datetime`
- `json`

Entity and field names must be lowercase/snake-case identifiers. The API normalizes common names, but agents should send clean identifiers. Do not use reserved table name `auth` or reserved field names: `id`, `_user_id`, `created_at`, `updated_at`.

App-user authentication is optional. Set `auth_enabled` to `true` only when the user needs `/api/auth/*`, signed-in app users, or owner-scoped records.

Prefer these table presets when choosing entity access:

- Private backend table: `read=server`, `write=server`
- Public read-only table: `read=public`, `write=server`
- Public table: `read=public`, `write=public`
- Signed-in users table: `read=authenticated`, `write=authenticated` and requires `auth_enabled=true`
- User-owned table: `read=owner`, `write=owner` and requires `auth_enabled=true`

Underlying entity access modes:

- `server`: requires a `ydb_...` site runtime token.
- `public`: no bearer token required.
- `authenticated`: requires an app-user `yusr_...` token.
- `owner`: requires an app-user `yusr_...` token and automatically scopes rows by system field `_user_id`.

### JavaScript SDK

Use the SDK for generated-site browser code instead of hand-written `fetch` calls. Read the current URLs and version from `GET /api/v1/agent-manifest` under `data.sdk`.

```html
<script src="https://yhub.net/sdk/v1/yhub.js"></script>
<script>
  const products = yhub.db.collection('products')
  const rows = await products.list({ limit: 20 })
</script>
```

Available database methods:

- `collection.list({ limit, offset })`
- `collection.get(id)`
- `collection.create(data)`
- `collection.update(id, data)` for a full `PUT`
- `collection.patch(id, data)`
- `collection.delete(id)`

Available authentication methods:

- `yhub.auth.register({ email, password, name })`
- `yhub.auth.login({ email, password })`
- `yhub.auth.loginWithTelegram(initData)` for a custom Mini App flow
- `yhub.auth.me()`
- `yhub.auth.logout()`

The SDK stores app-user tokens in `localStorage` by default and accepts a custom token store. It exposes `yhub.files`, `yhub.ai`, and `yhub.realtime` as unavailable namespace stubs until those runtime features ship. Use `await yhub.meta()` for runtime feature discovery.

The SDK defaults runtime requests to the generated site's current origin. Always use the absolute YHub app URL for the `<script>` source; do not use `/sdk/v1/yhub.js` from a generated site. Prefer public, authenticated, or owner access for browser apps. Never embed `ydb_...` server tokens in public JavaScript.

Use the User-owned table preset for user-specific data such as todos, game progress, settings, inventories, notes, or SaaS records that should only be visible to the logged-in app user. Do not ask the customer to create `_user_id`; Yhub creates and fills it automatically. When auth is enabled, Yhub also exposes read-only system tables `_users` and `_user_tokens` in the UI.

Create a site runtime Database API token:

```http
POST /api/v1/sites/{site}/database/tokens
Authorization: Bearer <yhub_access_token>
Content-Type: application/json
```

```json
{
  "name": "Frontend app",
  "abilities": ["read", "write"]
}
```

The response includes `plain_text_token` once. Capture it immediately. Yhub stores only the SHA-256 token hash.

Use a site runtime token against server-protected public site routes:

```http
POST https://example.yhub.net/api/products
Authorization: Bearer ydb_xxx
Content-Type: application/json
```

```json
{
  "title": "Demo product",
  "price": 19.99,
  "published": true
}
```

Runtime routes:

- `GET /api` lists entity names.
- `POST /api/auth/register` creates an app user and returns a `yusr_...` token when `auth_enabled=true`.
- `POST /api/auth/login` returns a `yusr_...` token when `auth_enabled=true`.
- `POST /api/auth/telegram` verifies raw Telegram Mini App `initData` and returns a `yusr_...` token when the site has a connected Telegram bot.
- `GET /api/auth/me` returns the current app user when `auth_enabled=true`.
- `POST /api/auth/logout` revokes the current app-user token when `auth_enabled=true`.
- `GET /api/{entity}` lists records, with optional `limit` and `offset`.
- `POST /api/{entity}` creates a record.
- `GET /api/{entity}/{id}` reads one record.
- `PATCH /api/{entity}/{id}` updates provided fields.
- `PUT /api/{entity}/{id}` updates and requires required fields.
- `DELETE /api/{entity}/{id}` deletes a record.

Important constraints:

- Enabling the managed Database API makes the site use PHP release runtime.
- If the site has no current release, deploy or redeploy the site after enabling the database so the generated `_yhub_api.php` endpoint is published.
- Do not expose the `ydb_...` token in public browser code unless the user explicitly accepts that risk. For browser apps with per-user data, configure entity access as `authenticated` or `owner` and use `yusr_...` app-user tokens from `/api/auth/login` or `/api/auth/register`.
- The managed Database API is for lightweight app data. For high-write workloads or relational business systems, recommend an external managed database/backend.

## Deployment status

- `created`, `in_setup`, `uploaded`, `permissions_set`: tell the user deployment is still running.
- `active`: return the public URL.
- `error`: report `status.error` and suggest a concrete next step.
- HTTP `401`: token is missing or invalid; reconnect.
- HTTP `403`: token lacks the needed permission; reconnect with the required ability.
- HTTP `422`: show the validation error in simple user-facing language.

## Files to deploy

When creating the site, send production-ready content:

- `html`: full document or body markup
- `css`: compiled CSS
- `js`: browser JavaScript
- `files`: an array of files for multi-file static, built frontend, or PHP-backed sites. Text files may omit `encoding`; binary assets must use `encoding: "base64"`.
- `bundle`: a multipart ZIP upload for larger built frontend/PHP sites. Prefer this for full React/Vite/Astro/Svelte builds with many assets.
- Supported file paths include `.html`, `.htm`, `.css`, `.js`, `.mjs`, `.json`, `.map`, `.svg`, `.txt`, `.xml`, `.webmanifest`, `.php`, images (`.avif`, `.gif`, `.ico`, `.jpeg`, `.jpg`, `.png`, `.webp`), fonts (`.eot`, `.otf`, `.ttf`, `.woff`, `.woff2`), media (`.mp3`, `.mp4`, `.wav`, `.webm`), `.wasm`, and `.pdf`.

Use PHP deliberately:

- Good fit: small handlers such as `contact.php`, `api.php`, `webhook.php`, or `index.php`.
- Good fit: calling third-party APIs with secret keys that must not reach the browser.
- Good fit: small server-rendered responses or proxy endpoints for private third-party API calls.
- Avoid: large frameworks, package-heavy applications, migration runners, queues, background daemons, long-running workers, socket servers, or complex backend apps unless Yhub explicitly supports that deployment shape.

Do not send source-only React/Vue/TypeScript projects through this skill yet unless the project has already been built into deployable static files or a small PHP-backed site. If build output is missing, build it locally first or ask the user for the build artifact.
