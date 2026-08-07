output "container_id" {
  description = "ID do container Docker da aplicação"
  value       = docker_container.pmo.id
}

output "container_name" {
  description = "Nome do container"
  value       = docker_container.pmo.name
}

output "app_url" {
  description = "URL de acesso à aplicação"
  value       = "http://localhost:${var.external_port}"
}

output "db_volume" {
  description = "Nome do volume Docker para o banco SQLite"
  value       = docker_volume.db.name
}

output "uploads_volume" {
  description = "Nome do volume Docker para uploads"
  value       = docker_volume.uploads.name
}
