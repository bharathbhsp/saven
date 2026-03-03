resource "aws_cognito_user_pool" "main" {
  name = "${var.name_prefix}-user-pool"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols  = false
    require_uppercase = true
  }

  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true
  }

  schema {
    name                = "name"
    attribute_data_type = "String"
    required            = false
    mutable             = true
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  admin_create_user_config {
    allow_admin_create_user_only = false
  }

  tags = {
    Name = "${var.name_prefix}-user-pool"
  }

  # Cognito does not allow modifying or removing schema attributes after creation.
  lifecycle {
    ignore_changes = [schema]
  }
}

resource "aws_cognito_user_pool_domain" "main" {
  # Must be globally unique; override cognito_domain in tfvars if this is taken
  domain       = "${var.cognito_domain}-${var.environment}"
  user_pool_id = aws_cognito_user_pool.main.id
}

# Gmail / Google login (optional). Enable when google_client_id and google_client_secret are set.
resource "aws_cognito_identity_provider" "google" {
  count = length(var.google_client_id) > 0 ? 1 : 0

  user_pool_id  = aws_cognito_user_pool.main.id
  provider_name = "Google"
  provider_type = "Google"

  provider_details = {
    client_id        = var.google_client_id
    client_secret    = var.google_client_secret
    authorize_scopes = "email openid profile"
  }

  attribute_mapping = {
    email    = "email"
    username = "sub"
    name     = "name"
  }
}

resource "aws_cognito_user_pool_client" "app" {
  name         = "${var.name_prefix}-app-client"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret                      = false
  refresh_token_validity                = 30
  access_token_validity                 = 60
  id_token_validity                     = 60
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]

  # Include Google when IdP is created so users can sign in with Gmail
  supported_identity_providers = length(aws_cognito_identity_provider.google) > 0 ? ["COGNITO", "Google"] : ["COGNITO"]

  # Must include the exact origin the frontend uses (e.g. http://localhost:5173/ or http://127.0.0.1:5173/)
  callback_urls = concat([
    "http://localhost:3000/",
    "http://localhost:5173/",
    "http://127.0.0.1:5173/",
    "http://127.0.0.1:3000/"
  ], var.extra_callback_urls)
  logout_urls = concat([
    "http://localhost:3000/",
    "http://localhost:5173/",
    "http://127.0.0.1:5173/",
    "http://127.0.0.1:3000/"
  ], var.extra_logout_urls)

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code", "implicit"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
}
