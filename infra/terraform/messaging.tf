locals {
  queue_names = toset([
    "document-processing",
    "screenshot-intelligence",
    "meeting-postprocessing",
    "notification-delivery",
    "calendar-sync",
    "knowledge-processing",
    "training-processing",
  ])
}
resource "aws_sqs_queue" "dlq" {
  for_each                  = local.queue_names
  name                      = "${local.name}-${each.key}-dlq"
  kms_master_key_id         = aws_kms_key.sqs.arn
  message_retention_seconds = 1209600
}
resource "aws_sqs_queue" "jobs" {
  for_each                          = local.queue_names
  name                              = "${local.name}-${each.key}"
  kms_master_key_id                 = aws_kms_key.sqs.arn
  kms_data_key_reuse_period_seconds = 300
  receive_wait_time_seconds         = 20
  visibility_timeout_seconds        = 300
  message_retention_seconds         = 345600
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq[each.key].arn, maxReceiveCount = 5
  })
}
resource "aws_sqs_queue_redrive_allow_policy" "dlq" {
  for_each  = local.queue_names
  queue_url = aws_sqs_queue.dlq[each.key].id
  redrive_allow_policy = jsonencode({
    redrivePermission = "byQueue", sourceQueueArns = [aws_sqs_queue.jobs[each.key].arn]
  })
}
resource "aws_cloudwatch_event_bus" "domain" {
  name = "${local.name}-domain"
}
