# Phase 0 — Infrastructure (Terraform)
# See docs/dev-phases.md

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

module "auth" {
  source = "./modules/auth"

  project_name          = var.project_name
  environment           = var.environment
  name_prefix           = local.name_prefix
  cognito_domain        = var.cognito_domain
  google_client_id      = var.google_client_id
  google_client_secret  = var.google_client_secret
  extra_callback_urls   = var.extra_callback_urls
  extra_logout_urls     = var.extra_logout_urls
}

module "data" {
  source = "./modules/data"

  project_name = var.project_name
  environment  = var.environment
  name_prefix  = local.name_prefix
}

module "api" {
  source = "./modules/api"

  project_name            = var.project_name
  environment             = var.environment
  name_prefix             = local.name_prefix
  aws_region              = var.aws_region
  cognito_pool_arn        = module.auth.user_pool_arn
  cognito_pool_id         = module.auth.user_pool_id
  cognito_client_id       = module.auth.app_client_id
  dynamodb_tables         = module.data.dynamodb_tables
  exports_bucket_arn      = module.frontend.exports_bucket_arn
  telegram_bot_token_ssm = aws_ssm_parameter.telegram_bot_token.name
}

module "frontend" {
  source = "./modules/frontend"

  project_name = var.project_name
  environment  = var.environment
  name_prefix  = local.name_prefix
}

# Parameter Store placeholders for secrets (Phase 6 & 7)
resource "aws_ssm_parameter" "google_credentials" {
  name        = "/${local.name_prefix}/google-sheets/credentials"
  description = "Google API credentials for Sheets sync (placeholder until Phase 6)"
  type        = "SecureString"
  value       = "placeholder"
  overwrite   = true
}

resource "aws_ssm_parameter" "telegram_bot_token" {
  name        = "/${local.name_prefix}/telegram/bot-token"
  description = "Telegram bot token (Phase 6); set via tfvars or TF_VAR_telegram_bot_token"
  type        = "SecureString"
  value       = coalesce(var.telegram_bot_token, "placeholder")
  overwrite   = true
}
