# Telegram Mini Apps

Read this reference when a YHub-hosted site opens inside Telegram and needs a personal app-user session. It does not apply to bot updates. Managed bot webhooks use [php-sdk-telegram.md](php-sdk-telegram.md) instead.

## Configure the site

Enable the managed Database API with `auth_enabled: true`. Store player state in an `owner` collection such as `game_progress`; YHub fills `_user_id` from the app-user token and rejects another user's records.

The site needs a Telegram bot connected in its YHub Telegram settings before Mini App login can work. Configure the Mini App URL in BotFather separately. Do not put the BotFather token, a webhook secret, `ydb_...`, or `yusr_...` fixtures in deployment files or browser code.

## Start the browser app

Load the browser SDK from the URL in `GET /api/v1/agent-manifest` and call `yhub.telegram.start()` after the Telegram client makes `window.Telegram.WebApp` available:

```html
<script src="https://yhub.net/sdk/v1/yhub.js"></script>
<script>
  ;(async () => {
    const session = await yhub.telegram.start({ fullscreen: true })

    if (session.authenticated) {
      const progress = yhub.db.collection('game_progress')
    }
  })()
</script>
```

`start()` calls `ready()` and `expand()`, attempts fullscreen only when supported, then exchanges the official raw `Telegram.WebApp.initData` with YHub. It stores the returned app-user token through the SDK token store. Do not pass `initDataUnsafe` to `loginWithTelegram()` and do not log raw `initData`.

Outside Telegram, `start()` returns `{ status: 'not_available', authenticated: false }` without an auth request or a new user. Use that result to keep the ordinary browser version working.

Use `yhub.telegram.themeParams`, `safeAreaInset`, `contentSafeAreaInset`, and `on()` for Telegram UI lifecycle state. Call `dispose()` when the app shell unmounts.
