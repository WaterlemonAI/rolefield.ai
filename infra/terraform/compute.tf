resource "aws_ecr_repository" "app" {
  name                 = local.name
  image_tag_mutability = "IMMUTABLE"
  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.data.arn
  }
  image_scanning_configuration { scan_on_push = true }
}
resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1, description = "Expire untagged images", selection = {
        tagStatus = "untagged", countType = "sinceImagePushed", countUnit = "days", countNumber = 14
        }, action = {
        type = "expire"
      }
    }]
  })
}
resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${local.name}"
  retention_in_days = 90
  kms_key_id        = aws_kms_key.data.arn
}
resource "aws_ecs_cluster" "main" {
  name = local.name
  setting {
    name  = "containerInsights"
    value = "enhanced"
  }
}

resource "aws_lb" "app" {
  name                       = substr(local.name, 0, 32)
  internal                   = false
  load_balancer_type         = "application"
  security_groups            = [aws_security_group.alb.id]
  subnets                    = aws_subnet.public[*].id
  drop_invalid_header_fields = true
  enable_deletion_protection = var.environment == "production"
}
resource "aws_lb_target_group" "app" {
  name                 = substr("${local.name}-app", 0, 32)
  port                 = 3000
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = aws_vpc.main.id
  deregistration_delay = 60
  health_check {
    path                = "/api/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200-399"
  }
}
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.app.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"

    }

  }
}
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.app.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.alb_certificate_arn
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn

  }
}

resource "aws_ecs_task_definition" "app" {
  family                   = local.name
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn
  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }
  container_definitions = jsonencode([{
    name = "app", image = "${aws_ecr_repository.app.repository_url}:${var.image_tag}", essential = true, readonlyRootFilesystem = true, command = ["pnpm", "web:start"], portMappings = [{
      containerPort = 3000, protocol = "tcp"
      }], stopTimeout = 60, environment = [{
      name = "NODE_ENV", value = "production"
      }, {
      name = "APP_URL", value = var.app_url
      }, {
      name = "API_URL", value = var.api_url
      }, {
      name = "AWS_REGION", value = var.aws_region
      }, {
      name = "SES_REGION", value = var.ses_region
      }, {
      name = "SES_CONFIGURATION_SET", value = var.ses_configuration_set
      }, {
      name = "INVITATION_FROM_EMAIL", value = var.invitation_from_email
      }, {
      name = "S3_REGION", value = var.aws_region
      }, {
      name = "S3_BUCKET", value = aws_s3_bucket.assets.id
      }, {
      name = "S3_KMS_KEY_ID", value = aws_kms_key.data.arn
      }, {
      name = "INBOUND_SQS_QUEUE_URL", value = aws_sqs_queue.jobs["notification-delivery"].url
      }, {
      name = "MEETING_S3_REGION", value = var.aws_region
      }, {
      name = "MEETING_S3_BUCKET", value = aws_s3_bucket.assets.id
      }, {
      name = "MEETING_S3_KMS_KEY_ID", value = aws_kms_key.data.arn
      }, {
      name = "MEETING_CLOUDFRONT_DOMAIN", value = aws_cloudfront_distribution.assets.domain_name
      }, {
      name = "MEETING_CLOUDFRONT_KEY_PAIR_ID", value = aws_cloudfront_public_key.assets.id
      }, {
      name = "EVENTBRIDGE_REGION", value = var.aws_region
      }, {
      name = "EVENTBRIDGE_BUS_NAME", value = aws_cloudwatch_event_bus.domain.name
      }, {
      name = "EVENTBRIDGE_SOURCE", value = var.eventbridge_source
      }, {
      name = "MEETING_SQS_REGION", value = var.aws_region
      }, {
      name = "SQS_DOCUMENT_PROCESSING_URL", value = aws_sqs_queue.jobs["document-processing"].url
      }, {
      name = "SQS_SCREENSHOT_INTELLIGENCE_URL", value = aws_sqs_queue.jobs["screenshot-intelligence"].url
      }, {
      name = "SQS_MEETING_POSTPROCESSING_URL", value = aws_sqs_queue.jobs["meeting-postprocessing"].url
      }, {
      name = "SQS_NOTIFICATION_DELIVERY_URL", value = aws_sqs_queue.jobs["notification-delivery"].url
      }, {
      name = "SQS_CALENDAR_SYNC_URL", value = aws_sqs_queue.jobs["calendar-sync"].url
      }, {
      name = "SQS_KNOWLEDGE_PROCESSING_URL", value = aws_sqs_queue.jobs["knowledge-processing"].url
      }, {
      name = "SQS_TRAINING_PROCESSING_URL", value = aws_sqs_queue.jobs["training-processing"].url
      }, {
      name = "REDIS_URL", value = "rediss://${aws_elasticache_replication_group.valkey.primary_endpoint_address}:6379"
      }, {
      name = "VALKEY_URL", value = "rediss://${aws_elasticache_replication_group.valkey.primary_endpoint_address}:6379"
      }], secrets = [{
      name = "DATABASE_URL", valueFrom = "${aws_secretsmanager_secret.database.arn}:url::"
      }, {
      name = "OLV_SESSION_SECRET", valueFrom = "${aws_secretsmanager_secret.application.arn}:OLV_SESSION_SECRET::"
      }, {
      name = "PASSWORD_PEPPER", valueFrom = "${aws_secretsmanager_secret.application.arn}:PASSWORD_PEPPER::"
      }, {
      name = "ENCRYPTION_KEY", valueFrom = "${aws_secretsmanager_secret.application.arn}:ENCRYPTION_KEY::"
      }, {
      name = "INBOUND_WEBHOOK_SECRET", valueFrom = "${aws_secretsmanager_secret.application.arn}:INBOUND_WEBHOOK_SECRET::"
      }, {
      name = "SES_EVENT_WEBHOOK_SECRET", valueFrom = "${aws_secretsmanager_secret.application.arn}:SES_EVENT_WEBHOOK_SECRET::"
      }, {
      name = "MEETING_CLOUDFRONT_PRIVATE_KEY", valueFrom = "${aws_secretsmanager_secret.application.arn}:MEETING_CLOUDFRONT_PRIVATE_KEY::"
      }], logConfiguration = {
      logDriver = "awslogs", options = {
        "awslogs-group" = aws_cloudwatch_log_group.app.name, "awslogs-region" = var.aws_region, "awslogs-stream-prefix" = "app"
      }
    }
  }])
}
resource "aws_ecs_service" "app" {
  name                               = "app"
  cluster                            = aws_ecs_cluster.main.id
  task_definition                    = aws_ecs_task_definition.app.arn
  desired_count                      = var.desired_count
  launch_type                        = "FARGATE"
  platform_version                   = "1.4.0"
  enable_execute_command             = false
  health_check_grace_period_seconds  = 120
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.app.id]
    assign_public_ip = false
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "app"
    container_port   = 3000
  }
  depends_on = [aws_lb_listener.https]
}
