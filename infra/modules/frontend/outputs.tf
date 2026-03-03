output "app_bucket_name" {
  value = aws_s3_bucket.app.id
}

output "app_bucket_arn" {
  value = aws_s3_bucket.app.arn
}

output "exports_bucket_name" {
  value = aws_s3_bucket.exports.id
}

output "exports_bucket_arn" {
  value = aws_s3_bucket.exports.arn
}

output "cloudfront_id" {
  value = aws_cloudfront_distribution.app.id
}

output "cloudfront_url" {
  value = "https://${aws_cloudfront_distribution.app.domain_name}"
}

output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.app.domain_name
}
