terraform {
  required_version = ">= 1.7.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"

    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"

    }

  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = local.tags
  }
}

data "aws_caller_identity" "current" {}
data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name = "${var.project}-${var.environment}"
  tags = merge(var.tags, {
    Project = var.project, Environment = var.environment, ManagedBy = "terraform"
  })
}
