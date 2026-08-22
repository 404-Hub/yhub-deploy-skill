# PHP SDK and managed Telegram bots

Read this reference when a YHub deployment uses the PHP SDK or receives Telegram updates.

## Choose the PHP SDK build

The official SDK repository is [404-Hub/yhub-telegram-sdk](https://github.com/404-Hub/yhub-telegram-sdk). It supports PHP 8.2 and newer without runtime dependencies.

For a YHub-hosted site, copy the repository's `dist/yhub.php` into the deployed PHP application. Require that file directly. This avoids a Composer install and a deployed `vendor/` tree.

Use the Composer package `yhub-cloud/php-sdk` for an ordinary PHP project only when the requested release is available from its package registry. Do not assume the Composer package has unreleased code from the repository's main branch.

The PHP SDK has two separate jobs:

- `Yhub\Sdk\Client` calls a site's managed runtime API from trusted PHP code.
- `Yhub\Sdk\Telegram\Bot` receives and routes Telegram webhook updates.

The runtime API client mirrors the database collection methods in the browser SDK:

```php
<?php

declare(strict_types=1);

require __DIR__.'/yhub.php';

$yhub = new Yhub\Sdk\Client('https://my-site.yhub.net/api', $siteApiToken);
$messages = $yhub->collection('messages');

$messages->create([
    'chat_id' => $chatId,
    'text' => 'Hello',
]);

$rows = $messages->list(['limit' => 20]);
```

Available collection methods are `list`, `get`, `create`, `update`, `patch`, and `delete`. A `ydb_...` site token belongs in trusted PHP code. Never expose it in browser JavaScript.

## Build a managed Telegram handler

Deploy `yhub.php` beside `telegram.php` at the deployment root. A Telegram bot bundle should normally contain `index.php`, `telegram.php`, and `yhub.php` at its ZIP root. If the local project keeps deployable files in `public/`, archive the contents of that directory instead of nesting the directory itself. The same handler call may live in `index.php` when a separate `telegram.php` is unnecessary.

```php
<?php

declare(strict_types=1);

use Yhub\Sdk\Telegram\Bot;
use Yhub\Sdk\Telegram\Update;
use Yhub\Sdk\Telegram\WebhookResponse;

require __DIR__.'/yhub.php';

if (Bot::serveFromYhub(static function (Bot $bot): void {
    $bot->command('start', static function (Update $update): WebhookResponse {
        return WebhookResponse::sendMessage(
            $update->chatId() ?? 0,
            'Hello from YHub!',
        );
    });

    $bot->onText(static function (Update $update): WebhookResponse {
        return WebhookResponse::sendMessage(
            $update->chatId() ?? 0,
            'You said: '.($update->text() ?? ''),
        );
    });
})) {
    return;
}
```

`telegram.php` is the recommended handler because it keeps bot routing separate from the website. YHub falls back to `index.php` when `telegram.php` does not exist. Direct requests to `/telegram.php` are denied.

`Bot::serveFromYhub()` checks for the exact managed request marker before it reads credentials, opens the update store, or runs the configuration callback. It returns `false` on ordinary site requests. Keep the guard when the handler shares `index.php` with a website.

## Connect the bot

The Agent API deploys site files but does not accept Telegram credentials. After the PHP deployment reaches `active`, direct the user to the site's Telegram settings in YHub. The user pastes the BotFather token there. Do not ask them to paste it into the agent chat.

YHub then:

- generates the webhook secret;
- stores the bot token and secret outside the web root;
- exposes the credentials to the site at `/etc/yhub/secrets/telegram.json`;
- registers the site's stable YHub domain at `/tg_webhook` with Telegram;
- verifies the remote webhook and reports the connection status.

Do not create a `/tg_webhook` file. Do not call `setWebhook()` for a managed bot. Connecting the bot moves its webhook to YHub, so warn the user if another service currently receives that bot's updates.

The connection moves through `pending`, `waiting_runtime`, `waiting_handler`, `registering`, and `active`. An `error` status needs attention. If YHub reports `waiting_handler`, confirm that the active PHP release contains `telegram.php` or `index.php`, then redeploy and retry the connection from the Telegram settings.

## Delivery and storage rules

Webhook handlers run synchronously. Keep them short. YHub's SDK uses `/runtime/telegram/updates.sqlite` only to suppress duplicate Telegram updates. Store bot application data in the managed Database API, not in that SQLite file.

A returned `WebhookResponse` uses Telegram's direct webhook response format. This is fast, but delivery is best-effort. The SDK marks the update complete before the web server can prove Telegram accepted the method.

Use the injected Telegram client when the handler needs a visible Bot API result:

```php
use Yhub\Sdk\Telegram\Client;

$bot->onText(static function (Update $update, Client $telegram): ?WebhookResponse {
    $telegram->sendMessage($update->chatId() ?? 0, 'Hello');

    return null;
});
```

If the client call throws, the SDK releases the update so Telegram can retry it. A lost network response can still repeat a call that Telegram already accepted. Do not promise exactly-once message delivery.

Never log update bodies, BotFather tokens, webhook secrets, or deduplication claim tokens. Event reporting should contain lifecycle names, update IDs, durations, and exception class names only.
