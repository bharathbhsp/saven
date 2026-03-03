# Saven

A spend tracking application built on the **AWS serverless** stack. Track daily, monthly, and custom date-range spending; organize by groups and categories; export to CSV or PDF; sync to Google Sheets; and record or view summaries via a **Telegram bot** (with optional NLP for free-text entry).

## Features

- **Record & view spend** — Daily, monthly, and custom date ranges
- **Export** — CSV and PDF
- **Integrations** — Google Sheets sync; Telegram bot (with optional mini-LLM NLP)
- **Categories** — Configurable categories for transactions
- **Multi-user** — Multiple people can edit and record; groups/buckets for different use cases

## Tech stack

- **Backend:** AWS Lambda + API Gateway  
- **Database:** DynamoDB (default) or Aurora Serverless v2  
- **Auth:** Amazon Cognito  
- **UI:** React or Next.js on S3 + CloudFront or Amplify Hosting  
- **Infrastructure:** Terraform  

## Docs

- [Requirements & architecture](docs/REQUIREMENTS.md) — Functional and non-functional requirements, AWS services, costs, file manifest  
- [Development phases](docs/dev-phases.md) — Phased development process (infra → data model → auth → APIs → UI → exports → Google Sheets → Telegram bot → multi-user polish)  

## Getting started

1. Review [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) and [docs/dev-phases.md](docs/dev-phases.md).  
2. Set up AWS and Terraform; provision infrastructure (Phase 0).  
3. Follow the phases in order to implement the app.

## Push to GitHub

The repo is initialized with `origin` pointing to `https://github.com/bharath/saven.git`. If the repository does not exist or you use a different username:

1. Create a new repository on GitHub named `saven` (no need to add a README or .gitignore).  
2. Update the remote and push:

   ```bash
   git remote set-url origin https://github.com/YOUR_USERNAME/saven.git
   git push -u origin main
   ```
