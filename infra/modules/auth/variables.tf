variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "name_prefix" {
  type = string
}

variable "cognito_domain" {
  type = string
}

variable "google_client_id" {
  type      = string
  default   = ""
  sensitive = true
}

variable "google_client_secret" {
  type      = string
  default   = ""
  sensitive = true
}

# Add production URLs (e.g. CloudFront) so Hosted UI can redirect back after login
variable "extra_callback_urls" {
  type        = list(string)
  default     = []
  description = "Additional Cognito callback URLs (e.g. https://your-cloudfront-url.net/)"
}

variable "extra_logout_urls" {
  type        = list(string)
  default     = []
  description = "Additional Cognito logout redirect URLs"
}
