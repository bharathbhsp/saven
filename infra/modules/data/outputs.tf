output "dynamodb_tables" {
  value = {
    groups         = aws_dynamodb_table.groups.name
    group_members  = aws_dynamodb_table.group_members.name
    categories     = aws_dynamodb_table.categories.name
    transactions   = aws_dynamodb_table.transactions.name
  }
}

output "groups_table_arn" {
  value = aws_dynamodb_table.groups.arn
}

output "group_members_table_arn" {
  value = aws_dynamodb_table.group_members.arn
}

output "categories_table_arn" {
  value = aws_dynamodb_table.categories.arn
}

output "transactions_table_arn" {
  value = aws_dynamodb_table.transactions.arn
}
