terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }

  # Use local backend by default. For team use, switch to S3 + DynamoDB:
  # backend "s3" {
  #   bucket         = "saven-tfstate"
  #   key            = "saven/terraform.tfstate"
  #   region         = "ap-south-2"
  #   dynamodb_table = "saven-tfstate-lock"
  #   encrypt        = true
  # }
  backend "local" {
    path = "terraform.tfstate"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
