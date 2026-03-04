output "api_gateway_url" {
  description = "API Gateway HTTP API invoke URL"
  value       = module.api.api_url
}

output "api_gateway_id" {
  description = "API Gateway HTTP API ID"
  value       = module.api.api_id
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.auth.user_pool_id
}

output "cognito_app_client_id" {
  description = "Cognito App Client ID"
  value       = module.auth.app_client_id
}

output "cognito_domain" {
  description = "Cognito Hosted UI domain"
  value       = module.auth.cognito_domain
}

output "cognito_issuer_url" {
  description = "Cognito JWKS issuer URL (for JWT validation)"
  value       = module.auth.issuer_url
}

output "app_bucket_name" {
  description = "S3 bucket for front-end app assets"
  value       = module.frontend.app_bucket_name
}

output "exports_bucket_name" {
  description = "S3 bucket for export artifacts (CSV, PDF)"
  value       = module.frontend.exports_bucket_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for app"
  value       = module.frontend.cloudfront_id
}

output "cloudfront_url" {
  description = "CloudFront URL for the app (until custom domain)"
  value       = module.frontend.cloudfront_url
}

output "dynamodb_tables" {
  description = "DynamoDB table names"
  value       = module.data.dynamodb_tables
}

output "telegram_webhook_url" {
  description = "URL to set as Telegram bot webhook (Phase 6)"
  value       = "${module.api.api_url}/webhook/telegram"
}
