variable "app_name" {
  description = "Nome da aplicação (usado como prefixo nos recursos)"
  type        = string
  default     = "megag-pmo"
}

variable "image_name" {
  description = "Nome da imagem Docker"
  type        = string
  default     = "megag-pmo"
}

variable "image_tag" {
  description = "Tag da imagem Docker (ex: 1.0.0, latest, sha-abc1234)"
  type        = string
  default     = "latest"
}

variable "build_context" {
  description = "Caminho para o diretório raiz da aplicação (contexto do docker build)"
  type        = string
  default     = ".."
}

variable "external_port" {
  description = "Porta externa do host mapeada para a porta 3000 do container"
  type        = number
  default     = 3000
}

variable "jwt_secret" {
  description = "Segredo JWT para assinatura de tokens de sessão"
  type        = string
  sensitive   = true
}

variable "log_level" {
  description = "Nível de log da aplicação (debug, info, warn, error)"
  type        = string
  default     = "info"

  validation {
    condition     = contains(["debug", "info", "warn", "error"], var.log_level)
    error_message = "log_level deve ser: debug, info, warn ou error."
  }
}
