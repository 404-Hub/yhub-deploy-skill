# Yhub deploy site agent skill

Reusable agent skill for connecting an AI agent to Yhub and deploying websites through Yhub hosting.

## Copy-paste install

Open the browser instructions:

https://yhub.net/instructions/agent-skill

Paste this into your AI agent:

```text
Install the Yhub deploy skill from https://github.com/404-Hub/yhub-deploy-skill into your agent's skills or instructions directory as yhub-deploy-site. Read SKILL.md before deploying. When I ask you to publish or update a site on Yhub, use that skill and follow the Yhub Connect Agent flow.
```

Or install it directly:

```bash
export AGENT_SKILLS_DIR="/path/to/your/agent/skills"
mkdir -p "$AGENT_SKILLS_DIR"
git clone https://github.com/404-Hub/yhub-deploy-skill.git "$AGENT_SKILLS_DIR/yhub-deploy-site"
```

Change `AGENT_SKILLS_DIR` if your agent uses a different skills directory. Start a new agent session if the skill does not appear immediately.

## What it does

- Starts the Yhub Connect Agent pairing flow.
- Deploys static HTML/CSS/JavaScript sites.
- Deploys built frontend bundles and small PHP-backed sites.
- Supports Yhub managed Database API setup for lightweight CRUD endpoints.
- Deploys the YHub PHP SDK and managed Telegram bot handlers.
- Polls deployment status and reports the published site URL.

## Skill contents

- `SKILL.md` - agent-facing workflow and operational rules.
- `agents/openai.yaml` - optional UI metadata for compatible agent clients.
- `references/api-contract.md` - Yhub Agent API endpoint contract.
- `references/php-sdk-telegram.md` - PHP SDK and managed Telegram bot workflow.
- `scripts/wait-for-yhub-token.mjs` - helper for waiting on Connect Agent approval.

## Install

Clone this repository into your agent's skills directory:

```bash
git clone https://github.com/404-Hub/yhub-deploy-skill.git "$AGENT_SKILLS_DIR/yhub-deploy-site"
```

The folder name should remain `yhub-deploy-site` so it matches the skill name.

## Usage

Ask your agent to use the skill, for example:

```text
Use the yhub-deploy-site skill to connect my Yhub account and deploy this website.
```

The agent will open the Yhub Connect Agent flow, wait for approval, deploy the site, and return the public URL.
