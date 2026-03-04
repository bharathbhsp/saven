variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "name_prefix" {
  type = string
}

variable "cognito_pool_arn" {
  type = string
}

variable "cognito_pool_id" {
  type = string
}

variable "cognito_client_id" {
  type = string
}

variable "aws_region" {
  type    = string
  default = "ap-south-2"
}

variable "dynamodb_tables" {
  type = object({
    groups                    = string
    group_members             = string
    categories                = string
    transactions              = string
    telegram_links            = string
    telegram_link_codes       = string
    telegram_chat_links       = string
    telegram_chat_link_codes  = string
  })
}

variable "exports_bucket_arn" {
  type = string
}

variable "telegram_bot_token_ssm" {
  description = "SSM Parameter Store name for Telegram bot token (Phase 6)"
  type        = string
  default     = ""
}
