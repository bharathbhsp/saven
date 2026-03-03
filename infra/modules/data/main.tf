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
