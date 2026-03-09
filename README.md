# Saven

This project was created to solve a personal need: tracking spending with others, by group, with simple exports and a Telegram bot for quick entry. As Eric S. Raymond put it in *The Cathedral and the Bazaar*: **"Every good work of software starts by scratching a developer's personal itch."**

---

Saven is a spend-tracking application built on the **AWS serverless** stack. Track daily, monthly, and custom date-range spending; organize by groups and categories; export to CSV or PDF; sync to Google Sheets; and record or view summaries via a **Telegram bot** (with optional NLP for free-text entry).

## Features

- **Record & view spend** — Daily, monthly, and custom date ranges
- **Export** — CSV and PDF
- **Integrations** — Google Sheets sync; Telegram bot (with optional mini-LLM NLP)
- **Categories** — Configurable categories per user; use when adding transactions
- **Multi-user** — Multiple people can edit and record; groups/buckets for different use cases

## Tech stack

- **Backend:** AWS Lambda + API Gateway  
- **Database:** DynamoDB (default) or Aurora Serverless v2  
- **Auth:** Amazon Cognito  
- **UI:** React (Vite) on S3 + CloudFront or Amplify Hosting  
- **Infrastructure:** Terraform  

## Docs

Documentation lives in **[docs/](docs/)**:

| Doc | Description |
|-----|-------------|
| [REQUIREMENTS.md](docs/REQUIREMENTS.md) | Functional and non-functional requirements, AWS services, costs, file manifest |
| [app-overview-one-page.md](docs/app-overview-one-page.md) | One-page overview: what you can do in the app and with the Telegram bot |
| [dev-phases.md](docs/dev-phases.md) | Phased development (infra → data model → auth → APIs → UI → exports → Google Sheets → Telegram → polish) |
| [api.md](docs/api.md) | API contract: auth, groups, members, categories, transactions, export |
| [data-model.md](docs/data-model.md) | Core data model: DynamoDB tables, keys, GSIs, access patterns |
| [local-testing.md](docs/local-testing.md) | How to test locally (deployed API, Lambda invoke, local server, DynamoDB Local) |
| [infra-dev-prod-stages.md](docs/infra-dev-prod-stages.md) | Dev and prod Terraform stages (state, var files, deploy) |
| [invites.md](docs/invites.md) | Invite-only sign-in: sending invites via Cognito (Console or CLI) |

Other docs in `docs/` cover Telegram bot verification, bot suggestions, user flows, and infra separation.

## Repo layout

- **`backend/`** — Lambda API runtime (Node.js); packaged by Terraform and deployed to AWS.
- **`frontend/`** — React app (Vite); build output is synced to S3/CloudFront.
- **`infra/`** — Terraform (per-stage roots in `infra/dev/` and `infra/prod/`); references `backend/` for the Lambda zip.

## Deploy (dev / prod)

From the repo root, deploy backend and frontend for an environment (applies Terraform then builds and syncs the frontend):

```bash
./scripts/deploy.sh dev   # or: prod
```

Optional: use a var file (e.g. copy `infra/dev/dev.tfvars.example` to `infra/dev/dev.tfvars` and set values). For secrets use `TF_VAR_*` or the var file (do not commit secrets).

## Getting started

1. Review [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) and [docs/dev-phases.md](docs/dev-phases.md).
2. Set up AWS and Terraform; provision infrastructure (Phase 0). For dev/prod stages see [docs/infra-dev-prod-stages.md](docs/infra-dev-prod-stages.md). From the chosen infra root (e.g. `infra/dev/`), run `terraform init` and `terraform apply`. Install backend deps with `cd backend && npm install` before apply if you need PDF export.
3. Follow the phases in [docs/dev-phases.md](docs/dev-phases.md) to implement or run the app.
