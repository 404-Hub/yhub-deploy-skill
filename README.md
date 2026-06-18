# Yhub Deploy Site Skill

Codex skill for connecting an agent to Yhub and deploying websites through Yhub hosting.

## Copy-Paste Install

Paste this into Codex:

```text
Install the Codex skill from git@github.com:404-Hub/yhub-deploy-skill.git into ~/.codex/skills/yhub-deploy-site, then use $yhub-deploy-site when I ask you to deploy a website to Yhub.
```

Or install it directly:

```bash
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
git clone git@github.com:404-Hub/yhub-deploy-skill.git "${CODEX_HOME:-$HOME/.codex}/skills/yhub-deploy-site"
```

Start a new Codex thread if the skill does not appear immediately.

## What It Does

- Starts the Yhub Connect Agent pairing flow.
- Deploys static HTML/CSS/JavaScript sites.
- Deploys built frontend bundles and small PHP-backed sites.
- Supports Yhub managed Database API setup for lightweight CRUD endpoints.
- Polls deployment status and reports the published site URL.

## Skill Contents

- `SKILL.md` - agent-facing workflow and operational rules.
- `agents/openai.yaml` - Codex UI metadata.
- `references/api-contract.md` - Yhub Agent API endpoint contract.
- `scripts/wait-for-yhub-token.mjs` - helper for waiting on Connect Agent approval.

## Install

Clone this repository into a Codex skills directory:

```bash
git clone git@github.com:404-Hub/yhub-deploy-skill.git "${CODEX_HOME:-$HOME/.codex}/skills/yhub-deploy-site"
```

The folder name should remain `yhub-deploy-site` so it matches the skill name.

## Usage

Ask Codex to use the skill, for example:

```text
Use $yhub-deploy-site to connect my Yhub account and deploy this website.
```

The agent will open the Yhub Connect Agent flow, wait for approval, deploy the site, and return the public URL.
