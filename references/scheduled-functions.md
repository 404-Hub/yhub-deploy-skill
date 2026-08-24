# Yhub Scheduled Functions

Scheduled Functions invoke one small PHP handler at times managed by Yhub. Deploy `scheduled.php` at the site's public root. Do not deploy `_yhub_schedule.php`; Yhub generates that signed gateway separately.

## Handler contract

`scheduled.php` must return a callable. The callable receives a verified event array:

```php
<?php

declare(strict_types=1);

return static function (array $event): void {
    $runId = (string) $event['run_id'];
    $eventName = (string) $event['name'];

    // Pass $runId as the idempotency key to storage or downstream APIs.
    if ($eventName === 'daily-summary') {
        // Perform one short, bounded unit of work.
    }
};
```

The event contains:

```json
{
  "run_id": "01K...",
  "site_id": 123,
  "schedule_id": 45,
  "name": "daily-summary",
  "source": "scheduled",
  "scheduled_for": "2026-08-24T08:00:00Z",
  "attempt": 1
}
```

`source` is `scheduled` for time-based runs and `manual` for run-now tests. A successful handler returns normally; Yhub records a `204` result. Throwing an exception records a bounded failure without exposing the exception or response body to agents.

## Idempotency

Delivery is at least once. Retries can invoke the same `run_id` again, so every external effect must be idempotent.

- Use `run_id` as a unique operation key in persistent storage or as the idempotency key supported by a downstream API.
- Check or insert that key before sending email, charging money, publishing, or mutating state.
- Return successfully when the same `run_id` was already completed.
- Do not substitute the schedule name or current timestamp; they do not identify one delivery attempt safely.

For managed Database API writes, use a server-side `ydb_...` token from protected server configuration. Never embed a runtime token or any other secret in browser JavaScript.

## Security and runtime limits

- The handler never receives Yhub's schedule signing credential.
- Never add a signing secret to deployment files, schedule API requests, browser JavaScript, or logs.
- Do not call `/api/schedules/run` yourself. It is a reserved platform route protected by signed headers.
- Keep work shorter than the plan timeout. Use an external job service for long-running tasks.
- Do not start processes, daemons, workers, or cron loops from the handler.

## Deployment and verification

1. Request `sites:schedules` during Connect Agent pairing only when schedule management is needed.
2. Deploy `scheduled.php` and wait for the site to become `active`.
3. Create the schedule with a cron expression and IANA timezone.
4. Run it manually once to validate the handler.
5. Read run history after the next due time and require a `succeeded` row whose `source` is `scheduled` before reporting automation as verified.

The exact schedule endpoints are documented in [api-contract.md](api-contract.md#scheduled-functions).
