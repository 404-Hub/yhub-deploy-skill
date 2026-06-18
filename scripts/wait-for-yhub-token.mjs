#!/usr/bin/env node

const args = process.argv.slice(2)

function usage() {
  console.error('Usage: wait-for-yhub-token.mjs <poll_url> [--interval=3000] [--timeout=900000]')
}

const pollUrl = args.find((arg) => !arg.startsWith('--'))

if (args.includes('--help') || args.includes('-h')) {
  usage()
  process.exit(0)
}

if (!pollUrl) {
  usage()
  process.exit(1)
}

const intervalMs = Number(
  args.find((arg) => arg.startsWith('--interval='))?.split('=')[1] ?? 3000
)
const timeoutMs = Number(
  args.find((arg) => arg.startsWith('--timeout='))?.split('=')[1] ?? 900000
)
const startedAt = Date.now()

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function poll() {
  while (Date.now() - startedAt < timeoutMs) {
    const response = await fetch(pollUrl, {
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Polling failed with HTTP ${response.status}: ${body}`)
    }

    const payload = await response.json()

    if (payload.status === 'approved') {
      if (!payload.access_token) {
        console.error('Connection approved, but the token was already consumed.')
        process.exit(5)
      }

      console.log(JSON.stringify(payload, null, 2))
      return
    }

    if (payload.status === 'denied') {
      console.error('Connection denied by user.')
      process.exit(2)
    }

    if (payload.status === 'expired') {
      console.error('Connection expired before approval.')
      process.exit(3)
    }

    console.error(`Waiting for user approval... status=${payload.status}`)
    await sleep(intervalMs)
  }

  console.error('Timed out waiting for user approval.')
  process.exit(4)
}

poll().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
