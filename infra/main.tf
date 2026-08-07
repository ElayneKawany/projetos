terraform {
  required_version = ">= 1.6"
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }

  # Descomente para armazenar estado remotamente (recomendado em produção)
  # backend "s3" {
  #   bucket = "megag-terraform-state"
  #   key    = "pmo/terraform.tfstate"
  #   region = var.aws_region
  # }
}

provider "docker" {}

# ── Rede interna ────────────────────────────────────────────────────────────
resource "docker_network" "pmo" {
  name = "${var.app_name}-network"
}

# ── Volume para banco de dados SQLite ───────────────────────────────────────
resource "docker_volume" "db" {
  name = "${var.app_name}-db"
}

# ── Volume para uploads ──────────────────────────────────────────────────────
resource "docker_volume" "uploads" {
  name = "${var.app_name}-uploads"
}

# ── Imagem da aplicação ──────────────────────────────────────────────────────
resource "docker_image" "pmo" {
  name = "${var.image_name}:${var.image_tag}"

  build {
    context    = var.build_context
    dockerfile = "Dockerfile"
    build_args = {
      JWT_SECRET = "build-placeholder-not-used-at-runtime"
    }
  }

  triggers = {
    dockerfile = filemd5("${var.build_context}/Dockerfile")
  }
}

# ── Container principal ──────────────────────────────────────────────────────
resource "docker_container" "pmo" {
  image   = docker_image.pmo.image_id
  name    = var.app_name
  restart = "unless-stopped"

  networks_advanced {
    name = docker_network.pmo.name
  }

  ports {
    internal = 3000
    external = var.external_port
  }

  env = [
    "NODE_ENV=production",
    "JWT_SECRET=${var.jwt_secret}",
    "LOG_LEVEL=${var.log_level}",
  ]

  volumes {
    volume_name    = docker_volume.db.name
    container_path = "/app/data"
  }

  volumes {
    volume_name    = docker_volume.uploads.name
    container_path = "/app/public/uploads"
  }

  healthcheck {
    test         = ["CMD", "wget", "-qO-", "http://localhost:3000/login"]
    interval     = "30s"
    timeout      = "10s"
    start_period = "20s"
    retries      = 3
  }

  labels {
    label = "app"
    value = var.app_name
  }
  labels {
    label = "version"
    value = var.image_tag
  }
}
