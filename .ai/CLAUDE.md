# CLAUDE.md

# Objetivo

Você é o desenvolvedor responsável pela evolução desta plataforma.

Seu objetivo é construir uma plataforma de **Governança de Projetos**, baseada no processo real do PMO da MegaG.

Toda implementação deve:

* preservar a arquitetura existente;
* reutilizar código sempre que possível;
* manter a estabilidade do sistema;
* priorizar as regras de negócio antes da solução técnica;
* evoluir continuamente sem comprometer funcionalidades já implementadas.

---

# Antes de qualquer implementação

Sempre execute esta sequência:

1. Leia o contexto do produto.
2. Leia as especificações relacionadas à funcionalidade.
3. Analise o código existente.
4. Entenda como a funcionalidade funciona hoje.
5. Identifique componentes, serviços e funções reutilizáveis.
6. Somente então implemente a melhoria.

Nunca implemente alterações sem compreender completamente o comportamento atual.

---

# Regras Gerais

## Preserve o que já existe

Nunca remova funcionalidades sem autorização explícita.

Sempre evolua a implementação existente.

---

## Trabalhe apenas no escopo solicitado

Implemente somente o que foi solicitado.

Não altere outros módulos sem necessidade.

Caso identifique melhorias fora do escopo:

* informe;
* não implemente sem aprovação.

---

## Reutilize código

Antes de criar qualquer componente:

* procure componentes existentes;
* procure serviços existentes;
* procure funções existentes;
* procure APIs existentes.

Evite código duplicado.

Sempre prefira evolução à criação de novos componentes.

---

## Informe impactos

Caso qualquer alteração impacte outros módulos:

Interrompa a implementação.

Explique:

* impacto;
* motivo;
* proposta de solução.

Somente implemente após aprovação.

---

## Banco de Dados

Nunca:

* remover tabelas;
* remover colunas;
* alterar estruturas críticas sem autorização.

Caso seja necessária alteração estrutural:

Apresente primeiro:

* impacto;
* proposta;
* estratégia de migração.

---

## Interface

Mantenha o padrão visual existente.

Não altere:

* layouts;
* componentes;
* identidade visual;

sem solicitação explícita.

---

## Segurança

Nunca remova:

* validações;
* autenticação;
* autorização;
* verificações de permissão.

Sempre respeite os perfis de acesso existentes.

---

# Arquitetura

A plataforma é composta por módulos independentes.

Cada módulo deverá possuir:

* Interface
* Regras de Negócio
* Histórico
* Workflow
* Versionamento

Evite implementar regras de negócio diretamente na interface.

Sempre centralize regras reutilizáveis em serviços.

---

# Governança dos Projetos

Esta plataforma representa o processo oficial do PMO da MegaG.

Sempre priorize a regra de negócio antes da implementação técnica.

O Projeto representa apenas o ciclo de vida.

Os documentos representam a execução do processo.

---

# Fluxo Oficial do Projeto

Todo projeto deverá seguir obrigatoriamente esta sequência:

Cadastro do Projeto

↓

TAP

↓

Estudo de Viabilidade

↓

Cronograma

↓

Execução

↓

Acompanhamento de Payback

↓

Encerramento

Nenhum módulo poderá alterar esta sequência sem atualização das especificações.

---

# Workflow

Todos os documentos utilizam exatamente o mesmo mecanismo de Workflow.

Fluxo padrão:

Rascunho

↓

Aguardando Envio

↓

Workflow Criado

↓

Aguardando Aprovação

↓

Aprovado

ou

Em Revisão

A aprovação sempre ocorre pelo módulo **Aprovações**.

Nenhum documento poderá possuir lógica própria de aprovação.

---

# PMO

O PMO não aprova documentos diretamente.

O PMO:

* elabora documentos;
* revisa documentos;
* envia documentos para aprovação;
* monta o Workflow de Aprovação.

O PMO somente poderá aprovar documentos quando fizer parte do Workflow criado.

Não existem privilégios especiais para o PMO durante a aprovação.

---

# Workflow de Aprovação

Todo Workflow deverá permitir informar:

* Ordem
* Usuário
* Tipo de Participação

Tipos disponíveis:

## Aprovação

Pode:

* Aprovar
* Reprovar
* Solicitar Revisão

## Ciência

Pode apenas:

* Registrar Ciência

Não poderá:

* Aprovar
* Reprovar
* Solicitar Revisão

O Workflow deverá ser reutilizado por todos os documentos da plataforma.

---

# Artefatos

Os artefatos oficiais da plataforma são:

* TAP
* Estudo de Viabilidade
* Cronograma

Futuramente:

* One Page
* Encerramento
* Mudança de Escopo
* Outros documentos do PMO

Todos os artefatos deverão possuir:

* Histórico
* Versionamento
* Workflow
* Status próprio

Nunca criar implementações específicas quando um mecanismo reutilizável puder ser utilizado.

---

# Histórico

Toda ação relevante deverá gerar Histórico.

Exemplos:

* criação;
* edição;
* alteração de status;
* envio para aprovação;
* aprovação;
* reprovação;
* revisão;
* criação automática de documentos;
* alteração de Workflow;
* registro de ciência.

O Histórico é parte obrigatória da plataforma.

---

# Versionamento

Todo documento deverá suportar versionamento.

Uma versão aprovada nunca deverá ser alterada.

Caso exista necessidade de alteração:

* criar nova versão;
* manter histórico completo;
* iniciar novo Workflow.

---

# Princípios do Produto

Sempre seguir estes princípios:

* O sistema representa o processo real do PMO da MegaG.
* Regras de negócio possuem prioridade sobre soluções técnicas.
* Sempre reutilizar componentes existentes.
* Sempre reutilizar serviços existentes.
* Sempre reutilizar APIs existentes.
* Evitar duplicação de código.
* Criar soluções reutilizáveis.
* Manter arquitetura limpa.
* Manter baixo acoplamento.
* Priorizar simplicidade.

---

# Antes de finalizar qualquer implementação

Verifique:

* Estou reutilizando código?
* Estou preservando a arquitetura?
* Existe solução mais simples?
* Estou alterando algo fora do escopo?
* Estou respeitando as regras de negócio?
* Estou reutilizando componentes existentes?
* Estou reutilizando serviços existentes?
* Estou evitando duplicação?

---

# Homologação

Nunca considere uma implementação concluída apenas porque compila.

Toda funcionalidade deverá ser validada quanto a:

* Regra de negócio
* Fluxo do usuário
* Permissões
* Histórico
* Atualização dos Status
* Workflow
* Integração entre módulos

Somente após homologação considerar a funcionalidade concluída.

---

# Definition of Done

Uma implementação somente estará concluída quando:

* Não houver erros de compilação.
* Não houver erros de TypeScript.
* Não houver código duplicado desnecessário.
* A arquitetura tiver sido preservada.
* Os componentes existentes tiverem sido reutilizados.
* Os serviços existentes tiverem sido reutilizados.
* O Histórico estiver funcionando.
* O Workflow estiver funcionando.
* O comportamento estiver aderente às regras de negócio.
* A funcionalidade tiver sido homologada.

---

# Resposta esperada ao finalizar uma implementação

Sempre informar:

1. Arquivos alterados.
2. O que foi implementado.
3. Componentes reutilizados.
4. Serviços reutilizados.
5. Impactos identificados.
6. Pendências para próximas Sprints.
7. Pontos que precisam de homologação.
