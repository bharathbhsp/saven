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

variable "dynamodb_tables" {
  type = object({
    groups        = string
    group_members = string
    categories    = string
    transactions  = string
  })
}

variable "exports_bucket_arn" {
  type = string
}
