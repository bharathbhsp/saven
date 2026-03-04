variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "ap-south-2"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "saven"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "cognito_domain" {
  description = "Cognito hosted UI domain prefix (must be unique across AWS)"
  type        = string
  default     = "saven-auth"
}

# Gmail / Google login (optional). Create OAuth 2.0 credentials in Google Cloud Console.
variable "google_client_id" {
  description = "Google OAuth 2.0 client ID for Gmail login (leave empty to disable)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "google_client_secret" {
  description = "Google OAuth 2.0 client secret for Gmail login (required if google_client_id is set)"
  type        = string
  default     = ""
  sensitive   = true
}

# Add production frontend URLs so Cognito Hosted UI can redirect back (avoids redirect_mismatch)
variable "extra_callback_urls" {
  description = "Additional Cognito callback URLs, e.g. [\"https://d123.cloudfront.net/\"]"
  type        = list(string)
  default     = []
}

variable "extra_logout_urls" {
  description = "Additional Cognito logout redirect URLs"
  type        = list(string)
  default     = []
}

# Phase 6 — Telegram bot. Prefer TF_VAR_telegram_bot_token=... for secrets.
variable "telegram_bot_token" {
  description = "Telegram bot token from BotFather (leave empty or use TF_VAR to disable/set)"
  type        = string
  default     = ""
  sensitive   = true
}
