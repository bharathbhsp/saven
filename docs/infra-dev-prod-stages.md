# Dev and prod stages — infra suggestions

Suggestions for running **dev** and **prod** as separate Terraform stages. No code changes are applied here; this is a guide for what to change when you adopt it.

---

## What you already have

- `**environment`** is already a variable (default `"dev"`) and is used in `**name_prefix**` (`${var.project_name}-${var.environment}`). All resources are named with that prefix (e.g. `saven-dev-groups`, `saven-prod-groups`).
- **Cognito domain** in the auth module is already environment-specific: `"${var.cognito_domain}-${var.environment}"` (e.g. `saven-auth-dev`, `saven-auth-prod`).
- **SSM parameters** use `local.name_prefix`, so dev and prod get different parameter paths (e.g. `/saven-dev/telegram/bot-token` vs `/saven-prod/telegram/bot-token`).

So **naming and resource separation by environment are already in place**. What’s missing for true **stage isolation** is **state separation** and **per-stage configuration**.

---

## 1. Terraform state per stage (required)

Right now you use a **local** backend with a single `terraform.tfstate`. If you run with `environment = "prod"` and then later with `environment = "dev"`, you’ll overwrite the same state and only one set of resources will be tracked. To have both dev and prod at the same time you need **separate state** for each stage.

**Options:**


| Approach                              | How                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Pros                                                                      | Cons                                                                                                    |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **A. Terraform workspaces**           | `terraform workspace new prod` (or `dev`), then `terraform workspace select dev` / `select prod`. Use **remote** backend (S3) so state key is per-workspace (e.g. `env:/dev/...`). Pass `-var="environment=dev"` or `-var="environment=prod"` when running, or set in tfvars.                                                                                                                                                                                                          | One codebase, one backend config; switch with `workspace select`.         | Workspaces are easy to misuse (e.g. forgetting to switch). Some teams prefer explicit dirs.             |
| **B. Separate backend key per stage** | Use **S3 backend** with a **different state key** per stage. You can’t use `var.environment` inside the `backend` block (it’s read before variables). So use **partial configuration**: leave `key` out of `versions.tf` and pass it at run time: `terraform init -reconfigure -backend-config="key=saven/prod/terraform.tfstate"` for prod and `key=saven/dev/terraform.tfstate` for dev. Run from the same `infra/` dir, and pass the right `-var-file` or `-var="environment=..."`. | Explicit key per stage; no workspaces.                                    | Two inits (or two backend config files) and you must pass the right backend-config every time you init. |
| **C. Separate root module per stage** | e.g. `infra/dev/` and `infra/prod/` (or `infra/environments/dev` and `infra/environments/prod`), each with its own `main.tf` (or symlinks to `../modules`) and its own `backend "s3" { key = "saven/dev/terraform.tfstate" }` vs `key = "saven/prod/terraform.tfstate"`.                                                                                                                                                                                                               | Very explicit; clear separation; different people can own different dirs. | Duplication or symlinks; more to maintain.                                                              |


**Recommendation:** Use **A (workspaces)** with an **S3 (and optionally DynamoDB) backend**, and always pass the matching `environment` (e.g. via `-var-file=dev.tfvars` or `prod.tfvars`). Keep a single `infra/` directory.

---

## 2. Backend (state) config changes (in `versions.tf`)

- Switch from `backend "local"` to **S3** (and optionally DynamoDB for locking). Create one S3 bucket (and one DynamoDB table) for Terraform state that **all** stages use; the state **key** (or workspace) differentiates dev vs prod.
- **If using workspaces:** e.g.  
`key = "saven/terraform.tfstate"`  
Terraform will store dev state at `env:/dev/saven/terraform.tfstate` and prod at `env:/prod/saven/terraform.tfstate` (or similar, depending on provider).
- **If using separate keys (no workspaces):** Omit `key` in the `backend "s3"` block and pass it via `-backend-config="key=saven/dev/terraform.tfstate"` or `key=saven/prod/terraform.tfstate` on `terraform init -reconfigure`.

You’ll need to create the S3 bucket (and DynamoDB table) once, either by hand or with a small bootstrap Terraform config.

---

## 3. Var files per stage

Create two tfvars files (do not commit secrets; use placeholders or CI secrets):

- `**infra/dev.tfvars`** (or `terraform.dev.tfvars`):
  - `environment = "dev"`
  - `cognito_domain = "saven-auth"` (or whatever you use; auth module appends `-dev`)
  - `extra_callback_urls` / `extra_logout_urls` = dev CloudFront URL if you have one
  - Leave secrets empty or use dev-only tokens (e.g. dev Telegram bot, dev OpenAI key).
- `**infra/prod.tfvars**` (or `terraform.prod.tfvars`):
  - `environment = "prod"`
  - `cognito_domain = "saven-auth"` (auth module appends `-prod`)
  - `extra_callback_urls` / `extra_logout_urls` = production frontend URL(s).
  - Prod secrets (Telegram, OpenAI, Google) via `TF_VAR_*` or a secret store; avoid putting them in committed files.

Run with:

- Dev: `terraform plan -var-file=dev.tfvars` and `terraform apply -var-file=dev.tfvars`.
- Prod: same with `prod.tfvars`, and ensure you’re on the correct workspace or backend key (see above).

---

## 4. What to set per stage (summary)


| Item                       | Dev                                  | Prod                                        |
| -------------------------- | ------------------------------------ | ------------------------------------------- |
| `**environment**`          | `"dev"`                              | `"prod"`                                    |
| **Terraform state**        | Separate (workspace or key)          | Separate (workspace or key)                 |
| **Cognito domain**         | e.g. `saven-auth` → `saven-auth-dev` | e.g. `saven-auth` → `saven-auth-prod`       |
| **Callback / logout URLs** | Dev CloudFront or local              | Prod CloudFront (or custom domain)          |
| **Telegram bot token**     | Optional; can use one bot for dev    | Prod bot; store in SSM for prod             |
| **OpenAI key**             | Optional (regex fallback ok for dev) | If using NLP in prod, set via TF_VAR or SSM |
| **Google OAuth**           | Optional                             | Prod client ID/secret if needed             |


No changes to module code are required; only variable values and state/backend config.

---

## 5. Optional: separate AWS accounts

For stronger isolation, use **different AWS accounts** for dev and prod. Then:

- Run Terraform with **different AWS credentials** (or roles) per account.
- Each account has its own S3 bucket for state (or one shared “terraform state” account with different keys).
- No change to Terraform modules; only to where you run Terraform and which credentials and backend key (or workspace) you use.

---

## 6. Optional: CI/CD

- **Dev:** On push to `dev` (or every push), run `terraform plan -var-file=dev.tfvars` and optionally `apply` (e.g. auto-apply for dev).
- **Prod:** On push to `main` (or release), run `terraform plan -var-file=prod.tfvars`; require **manual approval** before `apply`.
- Store secrets (e.g. `TF_VAR_telegram_bot_token`, `TF_VAR_openai_key`) in the CI secret store and inject them only for the relevant stage.
- Ensure CI uses the correct Terraform workspace or backend config (e.g. `terraform init -reconfigure -backend-config="key=saven/prod/terraform.tfstate"` for prod).

---

## 7. Checklist (no edits applied; for you to do)

- Create S3 bucket (and optional DynamoDB table) for Terraform state.
- In `versions.tf`: switch to `backend "s3"` (and optionally DynamoDB), with a key that supports either workspaces or a per-stage key.
- Decide: workspaces (dev/prod) vs separate backend key per stage vs separate root dirs.
- Add `dev.tfvars` and `prod.tfvars` with the right `environment` and URLs; keep secrets out of repo.
- Run `terraform init -reconfigure` (and workspace select if using workspaces); then plan/apply with the chosen var file and backend config for each stage.
- (Optional) Use separate AWS accounts and CI/CD with approval gates for prod.

Your existing `environment` and `name_prefix` usage already give you dev vs prod resource naming; the main change is **state separation** and **per-stage variables**.