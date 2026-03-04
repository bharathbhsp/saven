# Saven — Spend Tracking App — Requirements & Architecture

## Overview

A spend tracking application built on the **AWS serverless/functions ecosystem**, supporting multiple users, groups, and integrations (e.g. Google Sheets, Telegram bot).

---

## Functional Requirements

### 1. Recording & Viewing Spend
- **Daily spend** — Record and view spending for a given day.
- **Monthly spend** — Record and view spending for a given month.
- **Date range spend** — Record and view spending for any custom date range.

### 2. Export
- **CSV export** — Export transactions/spend data as CSV.
- **PDF export** — Export reports/summaries as PDF (e.g. by period, category, group).

### 3. Integrations
- **Google Sheets** — Option to sync/update a selected Google Sheet with spend data (e.g. by group, user, or date range).
- **Telegram bot** — Users can interact with Saven via Telegram: record transactions, view daily/monthly/range summaries, and optionally list recent transactions or categories (after linking Telegram identity to an app user). **NLP for free-text entry:** integrate a **mini-LLM** (small / cost-effective language model) to parse natural language and extract transaction data (e.g. amount, category, date) from messages like "50 on coffee yesterday" or "spent 20 at groceries".

### 4. Categorization
- **Categories** — Transactions must be assignable to categories (e.g. Food, Transport, Utilities).
- Categories should be configurable (create, rename, archive) and usable across users/groups as needed.

### 5. Multi-User & Collaboration
- **Multiple people** — Multiple users can edit and record transactions.
- Access control and audit (who added/edited what) should be considered.

### 6. Groups / Buckets
- **Groups or buckets** — Organize spending by use case (e.g. "Household", "Trip to Japan", "Side project").
- Each group can have its own members, categories (or shared), and optionally its own Google Sheet.

---

## Non-Functional / Technical Direction

- **AWS-native:** Use only AWS services and tools within the AWS ecosystem (no third-party hosting or external DBs for core app).
- **Backend:** AWS serverless (Lambda + API Gateway).
- **Database:** **DynamoDB** (default) or Aurora Serverless v2 — see [Database Recommendations](#database-recommendations).
- **UI:** **S3 + CloudFront** or **Amplify Hosting** — see [UI Recommendations](#ui-recommendations-aws-native).
- **Infrastructure:** **Terraform** for all AWS resource provisioning (no EC2 for app compute).
- Requirements and suggestions only; no code in this document.

---

## Why AWS Serverless Fits

- **Variable load** — Bursty traffic; Lambda scales to zero and out automatically; pay per use.
- **Managed infra** — No servers; API Gateway + Lambda for API; Cognito for auth; S3 for exports/assets.
- **Integrations** — Lambda can call Google Sheets API, generate PDFs, stream CSV, and handle Telegram Bot API webhooks.

**Caveats:** Cold starts (use provisioned concurrency only if needed); 15 min max per invocation (chunk or async for heavy PDF/export); all state in DB/S3; design DB for concurrent edits (e.g. optimistic locking).

---

## Database Recommendations

| Option | Pros | Cons | Best for |
|--------|------|------|----------|
| **DynamoDB** | Serverless-native, scales automatically, single-digit ms latency, good with Lambda in same region | No SQL; design around access patterns (e.g. by user, by group, by date); reporting/aggregation often needs extra logic or streams | Primary app DB: users, groups, transactions, categories. Use GSIs for "by date," "by group," "by user." |
| **Amazon Aurora Serverless v2 (PostgreSQL)** | SQL, flexible queries, date range and aggregation queries are straightforward, relational model fits categories and groups | Not "scale to zero" in the same way as DynamoDB; more operational and cost at very low usage | If you prefer SQL, complex reporting, and relational integrity (users → groups → transactions → categories). |
| **RDS (e.g. PostgreSQL)** | Familiar SQL, migrations, tooling | Not serverless; you manage or use Aurora Serverless v2 for scale-to-zero style | Use only if Aurora Serverless v2 is not chosen and you need a fixed RDS instance. |

**Suggestion (AWS-native only)**
- **Default choice:** **DynamoDB** for a fully serverless, AWS-native stack. Model: Users, Groups, GroupMembers, Transactions (with categoryId, groupId, userId, date), Categories (global or per-group). Terraform: `aws_dynamodb_table` + GSIs.
- **Alternative:** **Amazon Aurora Serverless v2 (PostgreSQL)** if you want SQL, complex date-range reports, and relational schema. Terraform: RDS/Aurora modules; ensure Lambda has VPC access if Aurora is in a VPC.

---

## UI Recommendations (AWS-Native)

| Option | Pros | Cons | Best for |
|--------|------|------|----------|
| **S3 + CloudFront** | Fully AWS-native, static site or SPA; Terraform can manage bucket, CloudFront distribution, OAI, cache behaviors | No SSR; you build and upload assets (e.g. via CI or Terraform null_resource) | React/Vite or Next.js static export; client calls API Gateway + Cognito. |
| **Amplify Hosting (Gen 2)** | AWS-native, integrated with Cognito, Git-based or manual deploy, preview branches | Tied to Amplify; may pull in Amplify libraries if you use full Amplify UI | Fastest AWS-native hosting with built-in CI from repo. |
| **Next.js (React)** | Good DX, SSR/SSG; can be exported as static and served from S3 + CloudFront | No Vercel; deploy artifact to S3 or use Amplify Hosting | Full-featured app; host on S3+CloudFront (static export) or Amplify. |
| **Progressive Web App (PWA)** | Installable, offline viewing with care | Offline write/sync adds complexity | Add later for mobile-friendly experience. |

**Suggestion**
- **Primary (AWS-native):** **React or Next.js** front-end hosted on **S3 + CloudFront** or **Amplify Hosting**. Use **Cognito** in the app for login; call **API Gateway** URLs. Terraform: `aws_s3_bucket`, `aws_cloudfront_distribution`, and optionally `aws_amplify_app` if using Amplify Hosting.
- **Later:** PWA and/or mobile wrapper if needed.

---

## Infrastructure: Terraform

- **Role:** Terraform provisions and configures all AWS resources; no manual console setup for core app infra.
- **Managed resources (examples):** API Gateway (REST or HTTP API), Lambda functions and permissions, DynamoDB tables (and GSIs) or Aurora/RDS, Cognito user pool and app client, S3 buckets (app assets, export artifacts), CloudFront distribution (and optional Route 53 if custom domain), IAM roles and policies, SSM Parameter Store (SecureString) for Google API credentials and Telegram bot token, CloudWatch log groups, and (if needed) EventBridge rules for scheduled sync. Lambda for Telegram webhook (invoked by HTTPS from Telegram).
- **No EC2 instances** for the application itself; compute is Lambda. Use EC2 only if a later requirement needs long-running or stateful workloads.
- **Suggestions:** Use Terraform modules (e.g. `auth`, `api`, `data`, `frontend`) and consider workspaces or separate `tfvars` for dev/staging/prod. Store Terraform state in **S3 + DynamoDB** backend for locking and team use.

---

## High-Level Architecture (Conceptual)

```
[Users] → [Web App on S3+CloudFront or Amplify] → [API Gateway] → [Lambda]
[Users] → [Telegram] → [API Gateway or direct] → [Lambda (webhook)]  → [DynamoDB / Aurora]
                                                                      [S3 — exports, assets]
                                                                      [Cognito — auth]
                                                                      [Google Sheets API — sync]
```

- **Auth:** Cognito (user pool); JWT in API Gateway or Lambda authorizer. All provisioned via Terraform.
- **API:** REST or HTTP API on API Gateway; Lambda per resource/action (transactions, groups, categories, exports, sync). Telegram: Lambda webhook invoked by Telegram; bot token in Parameter Store.
- **Exports:** Lambda generates CSV/PDF (in memory or to S3); return download link or stream.
- **Google Sheets:** Lambda uses Google API credentials (e.g. service account or OAuth) stored in **AWS Systems Manager Parameter Store** (SecureString); scheduled (EventBridge) or on-demand sync per group/sheet.
- **Telegram bot:** Lambda handles Telegram Bot API webhook; links Telegram user to app user; supports recording spend and viewing summaries. **NLP:** Optional integration with a **mini-LLM** (e.g. small open-weight model or managed "mini" API) so users can send free-text messages; Lambda calls the LLM to extract structured fields (amount, category, date) and then creates the transaction.

---

## Suggested Implementation Order

0. **Infrastructure** — Terraform for core resources (optional phase 0 or in parallel with 1).
1. **Core data model** — Users, Groups, GroupMembers, Categories, Transactions (date, amount, categoryId, groupId, userId, createdBy).
2. **Auth** — Cognito user pool and app client; protect API with JWT (API Gateway or Lambda authorizer).
3. **CRUD APIs** — Transactions (create, list by day/month/range), Categories, Groups.
4. **UI** — Login, dashboard, record transaction, list/filter by date and group.
5. **Exports** — CSV then PDF (Lambda; use S3 for large PDFs).
6. **Google Sheets** — Link sheet to group; sync via Lambda (EventBridge for scheduled).
7. **Telegram bot** — Webhook Lambda; link Telegram user to app user; commands to add transaction, view daily/monthly/range summary; optional **mini-LLM integration** for NLP to extract transaction data (amount, category, date) from free-text messages.
8. **Multi-user polish** — Group permissions, audit fields (createdAt, updatedAt, createdBy).

---

## Open Decisions (Affect Scope & Cost)

- **Transaction source:** Manual only, or also file upload (e.g. bank CSV) / bank linking?
- **Currency:** Single or multi-currency?
- **Recurring transactions:** In scope or later?
- **Budgets / alerts:** In scope or future phase?
- **Google Sheets:** One sheet per group vs one master sheet with tabs?
- **Telegram bot:** Which commands in scope (e.g. /add, /summary, /today, /month)? Link user via magic link to Cognito or simple bot-only auth? **Mini-LLM for NLP:** **GPT-4o mini** (OpenAI); key in SSM; see [telegram-mini-llm-suggestions.md](telegram-mini-llm-suggestions.md).

---

## Other AWS-Native Services

- **Parameter Store (SSM):** SecureString for Google API credentials; Standard tier free. (See [Infrastructure](#infrastructure-terraform) and [Costs](#aws-service-costs-reference).)
- **EventBridge:** Scheduled or event-driven triggers for Google Sheets sync or async exports. Scheduler has a generous free tier.
- **CI/CD:** CodePipeline + CodeBuild, or GitHub Actions with OIDC to AWS.
- **Monitoring:** CloudWatch Logs, Metrics, Alarms; optional X-Ray for tracing.
- **Custom domain:** Route 53 + ACM (certs free when used with CloudFront/API Gateway); Terraform-managed.

---

## AWS Service Costs (Reference)

Approximate pricing for AWS services used in this app. **Prices are indicative, vary by region, and change over time—confirm on [AWS Pricing](https://aws.amazon.com/pricing/) or the AWS Pricing Calculator.**

| Service | Pricing model | Typical / approximate cost (US regions) | Free tier / notes |
|---------|----------------|------------------------------------------|-------------------|
| **Lambda** | Per request + per GB-second | $0.20 per 1M requests; ~$0.0000166667 per GB-second (x86) | 1M requests/month + 400K GB-seconds/month always free |
| **API Gateway (HTTP API)** | Per request | $1.00 per 1M requests (first 300M); $0.90 per 1M above | 1M calls/month free for 12 months (new accounts). Data transfer out: ~$0.09/GB |
| **DynamoDB (on-demand)** | Per read/write request unit | Writes: ~$1.25 per 1M WRU; reads: ~$0.25 per 1M RRU | 25 GB storage free (always); pay per request |
| **Aurora Serverless v2** | Per ACU-hour | Per ACU-hour (region-dependent; check RDS Aurora pricing page) | No free tier; min 0.5 ACU; you pay for capacity used |
| **Cognito** | Per MAU (monthly active user) | Essentials: ~$0.015/MAU; Lite: ~$0.0055–$0.0025/MAU (volume); Plus: ~$0.02/MAU | 10,000 MAU/month free (Essentials/Lite), indefinite |
| **S3** | Storage + requests + transfer | Storage: ~$0.023/GB/month (Standard); PUT/GET per 1K requests (small) | 5 GB Standard, 20K GET, 2K PUT free for 12 months (new accounts) |
| **CloudFront** | Data transfer out + requests | ~$0.085/GB (first 10 TB, NA/EU); ~$0.0075–$0.01 per 1K requests | 1 TB data transfer out/month free (always); first 10M requests/month free |
| **Parameter Store (SSM)** | Per parameter (Advanced) or free (Standard) | Standard: free (up to 10K params, 4 KB each); Advanced: $0.05/parameter/month (8 KB, higher throughput) | Standard tier free; use SecureString for secrets (KMS key cost may apply) |
| **EventBridge** | Per event (64 KB chunks) | Custom events: $1.00 per 1M events; Scheduler: $1.00 per 1M after free tier | 14M Scheduler invocations/month free (always); same-account delivery to Lambda free |
| **CloudWatch Logs** | Ingestion + storage + queries | $0.50/GB ingested; Logs Insights: $0.005/GB scanned | 5 GB ingestion + 5 GB storage + 10 metrics + 3 dashboards + 10 alarms (free tier) |
| **CloudWatch Metrics / Alarms** | Per metric / per alarm | Custom metrics: $0.30/metric/month (after first 10); alarms: ~$0.10/alarm metric/month | First 10 custom metrics, 10 alarm metrics, 3 dashboards free |
| **Route 53** | Hosted zone + queries | $0.50/hosted zone/month (first 25); $0.40 per 1M queries | Alias to CloudFront/API Gateway etc.: no query charge for those |
| **ACM (Certificate Manager)** | Per certificate | $0 for public certs used with ELB, CloudFront, API Gateway | Use with CloudFront/API Gateway: no charge |
| **CodePipeline** | Per pipeline or per action minute | V1: $1/active pipeline/month; V2: $0.002/action minute (after free tier) | V2: 100 action minutes/month free |
| **CodeBuild** | Per build minute | ~$0.005/min (e.g. general1.small); varies by compute type | 100 build minutes/month free (EC2); 6K build seconds (Lambda) |

**Cost optimization for this app:** HTTP API (not REST); DynamoDB on-demand; Cognito Essentials (10K MAU free); S3 + CloudFront for UI (free tiers); Parameter Store Standard for credentials (free); EventBridge Scheduler free tier for sync; stay within Lambda/API Gateway free tiers where possible.

---

## File Manifest (To Create When You Start Coding)

- **Backend:** Lambda handlers, API Gateway config, DynamoDB tables (or Aurora schema); Lambda for Telegram webhook.
- **Front-end:** React or Next.js, Cognito integration, API client; deploy to S3 + CloudFront or Amplify Hosting.
- **IaC (Terraform):** API Gateway, Lambda (including Telegram webhook), DynamoDB/Aurora, Cognito, S3, CloudFront, IAM, Parameter Store, EventBridge (if used), state backend (S3 + DynamoDB).
- **Secrets:** Google API credentials and Telegram bot token in Parameter Store (SecureString).

---

*Requirements and architecture only; no code. Ready for design and implementation.*
