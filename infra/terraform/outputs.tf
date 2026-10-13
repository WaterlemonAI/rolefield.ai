output "ecr_repository_url" {
  value = aws_ecr_repository.app.repository_url
}
output "alb_dns_name" {
  value = aws_lb.app.dns_name
}
output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.assets.domain_name
}
output "assets_bucket" {
  value = aws_s3_bucket.assets.id
}
output "database_endpoint" {
  value     = aws_db_instance.postgres.endpoint
  sensitive = true
}
output "valkey_endpoint" {
  value     = aws_elasticache_replication_group.valkey.primary_endpoint_address
  sensitive = true
}
output "queue_urls" {
  value = {
    for key, queue in aws_sqs_queue.jobs : key => queue.url
  }
}
output "event_bus_name" {
  value = aws_cloudwatch_event_bus.domain.name
}
