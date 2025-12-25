terraform {
  backend "s3" {
    bucket         = "mindplex-terraform-state"
    key            = "services/semantic-search/dev/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "mindplex-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = "us-east-1"
}

data "terraform_remote_state" "foundation" {
  backend = "s3"
  config = {
    bucket = "mindplex-terraform-state"
    key    = "environments/dev/terraform.tfstate"
    region = "us-east-1"
  }
}

variable "image_tag" {
  description = "Docker image tag (Injected by CI)"
  type        = string
}

variable "DB_PASSWORD" {
  description = "Database password passed via env var TF_VAR_DB_PASSWORD"
  type        = string
  sensitive   = true
}


module "mindplex_semantic" {
  source = "git::https://github.com/Xcceleran-do/mindplex_infra.git//modules/app?ref=main"

  env      = "dev"
  app_name = "mindplex-semantic"

  vpc_id             = data.terraform_remote_state.foundation.outputs.vpc_id
  cluster_id         = data.terraform_remote_state.foundation.outputs.ecs_cluster_id
  subnets            = data.terraform_remote_state.foundation.outputs.public_subnets
  security_group_id  = data.terraform_remote_state.foundation.outputs.app_security_group_id
  execution_role_arn = data.terraform_remote_state.foundation.outputs.execution_role_arn

  enable_alb       = true
  alb_listener_arn = data.terraform_remote_state.foundation.outputs.https_listener_arn
  host_header      = "dev-search.mindplex.ai"
  path_pattern     = "/*"
  rule_priority    = 10

  image_url      = "${data.terraform_remote_state.foundation.outputs.ecr_repository_url_semantic}:${var.image_tag}"
  container_port = 3000

  environment_vars = [
    {
      name  = "DB_HOST"
      value = data.terraform_remote_state.foundation.outputs.db_endpoint
    },
    {
      name  = "DB_USER"
      value = "mindplex_admin"
    },
    {
      name  = "DB_PASS"
      value = var.DB_PASSWORD
    },
    {
      name  = "DB_NAME"
      value = "mindplex_semantic"
    },
    {
      name  = "DATABASE_URL"
      value = "postgresql://mindplex_admin:${var.DB_PASSWORD}@${data.terraform_remote_state.foundation.outputs.db_endpoint}:5432/mindplex_shared"
    },
    {
      name  = "TARGET_DATABASE_URL"
      value = "postgresql://mindplex_admin:${var.DB_PASSWORD}@${data.terraform_remote_state.foundation.outputs.db_endpoint}:5432/mindplex_shared"
    }
  ]
}
