# DynamoDB tables per docs/REQUIREMENTS.md and Phase 1 data model
# Groups, GroupMembers, Categories, Transactions (Users = Cognito)

resource "aws_dynamodb_table" "groups" {
  name         = "${var.name_prefix}-groups"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  tags = {
    Name = "${var.name_prefix}-groups"
  }
}

resource "aws_dynamodb_table" "group_members" {
  name         = "${var.name_prefix}-group-members"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "groupId"
  range_key    = "userId"

  attribute {
    name = "groupId"
    type = "S"
  }
  attribute {
    name = "userId"
    type = "S"
  }

  global_secondary_index {
    name            = "by-user"
    hash_key        = "userId"
    range_key       = "groupId"
    projection_type = "ALL"
  }

  tags = {
    Name = "${var.name_prefix}-group-members"
  }
}

resource "aws_dynamodb_table" "categories" {
  name         = "${var.name_prefix}-categories"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "groupId"
  range_key    = "categoryId"

  # groupId = "GLOBAL" for global categories
  attribute {
    name = "groupId"
    type = "S"
  }
  attribute {
    name = "categoryId"
    type = "S"
  }

  tags = {
    Name = "${var.name_prefix}-categories"
  }
}

resource "aws_dynamodb_table" "transactions" {
  name         = "${var.name_prefix}-transactions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "groupId"
  range_key    = "sk"

  # sk = date#transactionId e.g. 2025-02-28#uuid
  attribute {
    name = "groupId"
    type = "S"
  }
  attribute {
    name = "sk"
    type = "S"
  }
  attribute {
    name = "userId"
    type = "S"
  }

  global_secondary_index {
    name            = "by-user-date"
    hash_key        = "userId"
    range_key       = "sk"
    projection_type = "ALL"
  }

  tags = {
    Name = "${var.name_prefix}-transactions"
  }
}

# Phase 6 — Telegram bot: link Telegram user to app user
resource "aws_dynamodb_table" "telegram_links" {
  name         = "${var.name_prefix}-telegram-links"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "telegramUserId"

  attribute {
    name = "telegramUserId"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  global_secondary_index {
    name            = "by-user"
    hash_key        = "userId"
    range_key       = "telegramUserId"
    projection_type = "ALL"
  }

  tags = {
    Name = "${var.name_prefix}-telegram-links"
  }
}

# One-time codes for /link <code> (code -> userId, expiresAt)
resource "aws_dynamodb_table" "telegram_link_codes" {
  name         = "${var.name_prefix}-telegram-link-codes"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "code"

  attribute {
    name = "code"
    type = "S"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  tags = {
    Name = "${var.name_prefix}-telegram-link-codes"
  }
}

# Option C: Telegram group/supergroup chat -> Saven group (one Saven group per Telegram chat)
resource "aws_dynamodb_table" "telegram_chat_links" {
  name         = "${var.name_prefix}-telegram-chat-links"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "telegramChatId"

  attribute {
    name = "telegramChatId"
    type = "S"
  }

  attribute {
    name = "savenGroupId"
    type = "S"
  }

  global_secondary_index {
    name            = "by-group"
    hash_key        = "savenGroupId"
    projection_type = "ALL"
  }

  tags = {
    Name = "${var.name_prefix}-telegram-chat-links"
  }
}

# One-time codes for /linkgroup <code> (code -> groupId, userId, expiresAt)
resource "aws_dynamodb_table" "telegram_chat_link_codes" {
  name         = "${var.name_prefix}-telegram-chat-link-codes"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "code"

  attribute {
    name = "code"
    type = "S"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  tags = {
    Name = "${var.name_prefix}-telegram-chat-link-codes"
  }
}
