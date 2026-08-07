import { NextRequest, NextResponse } from 'next/server'
import { getSession, temPermissao } from '@/lib/auth'
import { ComitesRepository } from '@/lib/repositories'
import Anthropic from '@anthropic-ai/sdk'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'PMO')) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  const { id } = await params
  const comiteId = parseInt(id)

  const comite = ComitesRepository.findRaw(comiteId) as Record<string, unknown> | undefined
  if (!comite) return NextResponse.json({ error: 'Comitê não encontrado.' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const transcricao: string = body.transcricao || ''
  const horaInicio: string = body.hora_inicio || ''
  const horaFim: string = body.hora_fim || ''
  const duracaoMin: number = body.duracao_min || 0

  const participantes = ComitesRepository.findParticipantesNomeados(comiteId)
  const projetos = ComitesRepository.findProjetosParaAta(comiteId)
  const decisoesExistentes = ComitesRepository.findDecisoesSimplesComiteId(comiteId)
  const pendenciasExistentes = ComitesRepository.findPendenciasAbertas(comiteId)

  const contexto = {
    titulo: comite.titulo,
    data: comite.data_realizacao,
    tipo: comite.tipo,
    local: comite.local,
    hora_inicio: horaInicio || comite.hora,
    hora_fim: horaFim,
    duracao_minutos: duracaoMin,
    participantes_convidados: participantes.map(p => ({ nome: p.nome, cargo: p.cargo, presente: p.presente === 1 })),
    projetos_pautados: projetos,
    decisoes_registradas: decisoesExistentes,
    pendencias_registradas: pendenciasExistentes,
    transcricao_reuniao: transcricao || '(Transcrição não disponível — gerar com base nos dados estruturados)',
  }

  const client = new Anthropic()

  const promptSistema = `Você é um assistente especializado em governança corporativa e gestão de portfólio de projetos (PMO).
Sua tarefa é analisar a transcrição de uma reunião de Comitê Executivo e gerar uma Ata Oficial estruturada.

Retorne EXCLUSIVAMENTE um objeto JSON válido no seguinte formato (sem texto adicional antes ou depois):
{
  "resumo": "Resumo executivo objetivo da reunião (2-4 parágrafos)",
  "participantes_identificados": ["Nome 1", "Nome 2"],
  "ausentes": ["Nome dos convidados que não participaram"],
  "projetos_discutidos": [
    {
      "nome": "Nome do projeto",
      "status": "Status atual",
      "pontos": "Principais pontos discutidos",
      "problemas": "Problemas levantados (se houver)",
      "decisoes": "Decisões específicas para este projeto"
    }
  ],
  "decisoes": [
    { "descricao": "Decisão tomada", "responsavel": "Nome", "prazo": "YYYY-MM-DD ou null" }
  ],
  "pendencias": [
    { "descricao": "Pendência identificada", "responsavel": "Nome", "prazo": "YYYY-MM-DD ou null" }
  ],
  "plano_acao": [
    { "acao": "Ação a executar", "responsavel": "Nome", "prazo": "Data", "status": "PENDENTE" }
  ],
  "riscos": ["Risco identificado 1", "Risco identificado 2"],
  "observacoes": "Observações relevantes que não geraram decisão formal"
}

Instruções:
- Identifique decisões mesmo que não sejam explícitas — infira de contexto
- Se a transcrição mencionar nomes, identifique os participantes que falaram
- Extraia prazos e responsáveis sempre que mencionados
- Mantenha linguagem formal e objetiva
- Se não houver transcrição, use os dados estruturados do comitê`

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: 'claude-opus-4-8',
          max_tokens: 8192,
          thinking: { type: 'adaptive' },
          system: promptSistema,
          messages: [{
            role: 'user',
            content: `Analise os dados do Comitê Executivo abaixo e gere a Ata estruturada em JSON:\n\n${JSON.stringify(contexto, null, 2)}`,
          }],
        })

        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
        controller.close()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao gerar ata'
        controller.enqueue(encoder.encode(`{"error":"${msg}"}`))
        controller.close()
      }
    },
  })

  return new NextResponse(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    },
  })
}
