'use client'

interface Props {
  artefatoStatus: string
  /** Pode editar o conteúdo do documento */
  canEdit: boolean
  /** Pode enviar para aprovação (PMO/ADMIN) */
  canSubmit: boolean
  editing: boolean
  saving: boolean
  onEditar: () => void
  onEnviarParaAprovacao: () => void
  onSalvar: () => void
  onCancelar: () => void
}

export default function ArtefatoActions({
  artefatoStatus,
  canEdit,
  canSubmit,
  editing,
  saving,
  onEditar,
  onEnviarParaAprovacao,
  onSalvar,
  onCancelar,
}: Props) {
  // Modo edição ativo: Salvar + Cancelar (apenas RASCUNHO chega aqui editando)
  if (editing) {
    return (
      <>
        <button className="btn-primary text-sm" onClick={onSalvar} disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
        <button className="btn-secondary text-sm" onClick={onCancelar} disabled={saving}>
          Cancelar
        </button>
      </>
    )
  }

  // PENDENTE_APROVACAO — botões de aprovação ficam no WorkflowStatusPanel
  if (artefatoStatus === 'PENDENTE_APROVACAO') return null

  // CANCELADO — apenas visualização
  if (artefatoStatus === 'CANCELADO') return null

  // RASCUNHO e APROVADO — sempre exibe o botão Editar
  // Em APROVADO, onEditar exibe mensagem informativa (nenhum campo é habilitado)
  return (
    <>
      {canEdit && (
        <button className="btn-secondary text-sm" onClick={onEditar}>
          Editar
        </button>
      )}
      {canSubmit && artefatoStatus === 'RASCUNHO' && (
        <button className="btn-primary text-sm" onClick={onEnviarParaAprovacao}>
          Enviar para Aprovação
        </button>
      )}
    </>
  )
}
