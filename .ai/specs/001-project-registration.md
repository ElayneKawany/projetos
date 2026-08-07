# ESPECIFICAÇÃO FUNCIONAL 001

# Módulo de Projetos

Versão: 2.0

Status: Em elaboração

---

# Objetivo

Este módulo é responsável pelo gerenciamento do projeto durante todo o seu ciclo de vida.

Ele representa o núcleo da plataforma, concentrando todas as informações do projeto e integrando os demais módulos.

Todo projeto deverá seguir obrigatoriamente o fluxo definido em:

context/project-lifecycle.md

---

# Conceito

O Projeto é a principal entidade da plataforma.

Todos os documentos, aprovações, cronogramas, indicadores e informações financeiras pertencem ao Projeto.

A plataforma não trata TAP, Viabilidade e Cronograma como documentos independentes.

Eles representam etapas do ciclo de vida do Projeto.

---

# Cadastro

Ao cadastrar um projeto, deverão ser informados no mínimo:

- Nome do Projeto
- Solicitante
- Área Solicitante
- Gerente do Projeto
- Objetivo
- Justificativa
- Categoria
- Prioridade

Ao concluir o cadastro:

- gerar identificador único;
- definir a Fase como Iniciação;
- aplicar o Status Inicial configurado pela empresa;
- registrar o histórico da criação.

---

# Configuração de Status

Os Status serão totalmente configuráveis.

A empresa poderá:

- criar novos Status;
- editar;
- ativar;
- desativar;
- definir Status Inicial.

Caso um projeto utilize um Status inexistente, a plataforma deverá:

- apresentar alerta;
- impedir movimentações;
- registrar inconsistência no histórico.

---

# Estrutura do Projeto

Cada projeto possuirá as seguintes abas:

1. Visão Geral

2. TAP

3. Estudo de Viabilidade

4. Cronograma

5. Acompanhamento de Payback

6. Financeiro

7. Timeline

A Timeline permanecerá sempre como última aba.

---

# Visão Geral

A Visão Geral deverá apresentar um resumo executivo do projeto.

Esta tela será utilizada apenas para consulta.

---

# Navegação

Cada aba representa um módulo independente da plataforma.

Cada módulo possuirá sua própria especificação funcional.

---

# Integrações

O módulo Projetos será integrado com:

- TAP
- Estudo de Viabilidade
- Cronograma
- Financeiro
- Aprovações
- Timeline
- Auditoria

---

# Timeline

A Timeline deverá apresentar todos os acontecimentos do projeto em ordem cronológica.

Exemplos:

- Projeto criado
- TAP gerada
- TAP aprovada
- Viabilidade criada
- Viabilidade aprovada
- Cronograma importado
- Alterações financeiras
- Go Live
- Encerramento

---

# Histórico

Toda alteração deverá registrar:

- Usuário
- Data
- Hora
- Campo alterado
- Valor anterior
- Novo valor

Nenhuma alteração poderá ocorrer sem registro no histórico.

---

# Regras de Negócio

O módulo Projetos representa apenas a estrutura principal do projeto.

Cada funcionalidade operacional será implementada em seu respectivo módulo.

O Projeto será sempre a fonte oficial das informações da plataforma.

Os documentos serão apenas representações dos dados armazenados no sistema.