variable "aws_region" {
  type    = string
  default = "ap-south-1"
}

variable "project" {
  type    = string
  default = "rolefield"
}

variable "environment" {
  type    = string
  default = "production"
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production."

  }
}

variable "vpc_cidr" {
  type    = string
  default = "10.40.0.0/16"
}

variable "image_tag" {
  type        = string
  description = "Immutable application image tag (prefer a Git SHA)."
}

variable "desired_count" {
  type    = number
  default = 2
}

variable "task_cpu" {
  type    = number
  default = 1024
}

variable "task_memory" {
  type    = number
  default = 2048
}

variable "db_instance_class" {
  type    = string
  default = "db.m7g.large"
}

variable "db_allocated_storage" {
  type    = number
  default = 100
}

variable "db_engine_version" {
  type        = string
  default     = "17"
  description = "RDS PostgreSQL major family. AWS selects an available patch; pin after validating in-region."
}

variable "valkey_node_type" {
  type    = string
  default = "cache.t4g.small"
}

variable "alb_certificate_arn" {
  type        = string
  description = "ARN of an ACM certificate in aws_region for the public ALB HTTPS listener."
  validation {
    condition     = can(regex("^arn:aws[a-z-]*:acm:[a-z0-9-]+:[0-9]{12}:certificate/", var.alb_certificate_arn))
    error_message = "alb_certificate_arn must be an ACM certificate ARN."

  }
}

variable "domain_names" {
  type    = list(string)
  default = []
}

variable "cloudfront_certificate_arn" {
  type        = string
  default     = null
  nullable    = true
  description = "ACM certificate in us-east-1 for CloudFront aliases; omit when using the generated distribution domain."
}

variable "cloudfront_public_key_pem" {
  type        = string
  sensitive   = true
  description = "PEM public key paired with the CloudFront signing private key stored in the application secret."
  validation {
    condition     = can(regex("BEGIN PUBLIC KEY", var.cloudfront_public_key_pem))
    error_message = "cloudfront_public_key_pem must be a PEM encoded public key."
  }
}

variable "app_url" {
  type = string
}
variable "api_url" {
  type = string
}
variable "ses_region" {
  type = string
}
variable "ses_configuration_set" {
  type = string
}
variable "invitation_from_email" {
  type = string
}
variable "eventbridge_source" {
  type    = string
  default = "ai.rolefield.meetings"
}

variable "tags" {
  type    = map(string)
  default = {}
}
