# Agente de Criação de Cards no Jira com DeepSeek

Este projeto consiste em um Agente de Inteligência Artificial completo que transforma descrições livres em cards do Jira estruturados e formatados, contando com uma interface web interativa para revisão dos dados extraídos antes do envio final.

## 🚀 Como Funciona o Fluxo

1. **Entrada**: O usuário digita um texto livre contendo o relato de um problema ou tarefa a ser feita (ex: *"O leitor de código de barras abre o teclado virtual na tela de separação. Precisamos impedir..."*).
2. **Análise com DeepSeek (IA)**: A IA (`deepseek-chat`) processa o texto livre e extrai campos estruturados (Resumo, Tipo de Tarefa, Prioridade, Labels e Descrição em formato Markdown).
3. **Revisão e Edição**: Uma interface gráfica (Single Page Application) exibe as informações extraídas para o usuário validar, editar e visualizar a renderização em tempo real do Markdown.
4. **Conversão e Envio**: Quando confirmado, a descrição em Markdown é convertida para o **Atlassian Document Format (ADF)** usando a biblioteca `md-to-adf` e a tarefa é criada na API REST v3 do Jira Cloud.
5. **Resultado**: O link direto para o card criado no Jira é retornado ao usuário.

---

## 📁 Estrutura de Diretórios

```
jira-agent/
├── src/
│   ├── index.js            # Arquivo principal do servidor Express
│   ├── routes/
│   │   └── issue.js        # Definição de rotas (/analyze e /)
│   ├── services/
│   │   ├── deepseek.js     # Integração com a API do DeepSeek
│   │   └── jira.js         # Integração com a API REST v3 do Jira Cloud
│   ├── prompts/
│   │   └── jiraPrompt.js   # Prompt do sistema para o DeepSeek
│   ├── validators/
│   │   └── issueSchema.js  # Validação de dados de card com Zod
│   ├── utils/
│   │   └── adf.js          # Conversor de Markdown para ADF
│   └── public/             # Arquivos do Frontend Estático (HTML/CSS/JS)
│       ├── index.html
│       ├── style.css
│       └── app.js
├── .env.example            # Arquivo de exemplo para variáveis de ambiente
├── Dockerfile              # Dockerfile para build do container
├── docker-compose.yml      # Configuração para rodar com Docker Compose
├── package.json            # Definição de dependências e scripts npm
├── README.md               # Documentação do projeto
└── eslint.config.js        # Configuração de linting com ESLint 9+
```

---

## 🛠️ Requisitos
- **Node.js** v22 ou superior
- **Docker** e **Docker Compose** (caso opte por rodar em container)
- Conta no **Jira Cloud** (com API Token gerado)
- Chave de API do **DeepSeek**

---

## ⚙️ Configuração

1. Copie o arquivo `.env.example` para `.env`:
   ```bash
   cp .env.example .env
   ```
2. Abra o arquivo `.env` e preencha as variáveis de ambiente:
   - `PORT`: Porta do servidor local (padrão: `3000`).
   - `DEEPSEEK_API_KEY`: Sua chave privada da API do DeepSeek.
   - `JIRA_URL`: URL base do seu Jira Cloud (ex: `https://empresa.atlassian.net`).
   - `JIRA_EMAIL`: Endereço de e-mail da sua conta do Jira.
   - `JIRA_API_TOKEN`: Token de API gerado no seu painel da Atlassian ([Gerar Token](https://id.atlassian.com/manage-profile/security/api-tokens)).
   - `JIRA_PROJECT_KEY`: A chave da sigla do projeto onde os cards serão criados (ex: `WMS`).

---

## 🏃 Como Executar

### Opção 1: Execução Local (Node.js)

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Inicie o servidor em modo de desenvolvimento (com recarga automática ao editar arquivos):
   ```bash
   npm run dev
   ```
3. Para iniciar em modo de produção:
   ```bash
   npm start
   ```

### Opção 2: Execução com Docker

1. Certifique-se de que o arquivo `.env` está configurado no diretório raiz.
2. Inicie os containers com o comando:
   ```bash
   docker compose up --build
   ```
3. O servidor estará rodando em `http://localhost:3000`.

---

## 🌐 Endpoints da API

### 1. Health Check
- **Rota**: `GET /health`
- **Descrição**: Verifica o estado operacional do servidor backend.
- **Resposta**:
  ```json
  {
    "status": "ok",
    "timestamp": "2026-06-18T19:25:00.000Z",
    "uptime": 12.34
  }
  ```

### 2. Análise e Estruturação de Texto (DeepSeek)
- **Rota**: `POST /api/issue/analyze`
- **Payload**:
  ```json
  {
    "texto": "O leitor de código de barras abre o teclado virtual na tela de separação. Precisamos impedir a abertura do teclado para melhorar a produtividade."
  }
  ```
- **Resposta**:
  ```json
  {
    "issueType": "Bug",
    "summary": "Impedir abertura do teclado virtual na tela de separação",
    "priority": "Medium",
    "labels": ["wms", "mobile", "scanner"],
    "description": "## Contexto\nNa tela de separação...\n\n## Problema\nO leitor..."
  }
  ```

### 3. Criação de Issue no Jira
- **Rota**: `POST /api/issue`
- **Payload** (Dados estruturados validados pelo Zod):
  ```json
  {
    "issueType": "Bug",
    "summary": "Impedir abertura do teclado virtual na tela de separação",
    "priority": "Medium",
    "labels": ["wms", "mobile", "scanner"],
    "description": "## Contexto\nNa tela de separação...\n\n## Problema\nO leitor..."
  }
  ```
- **Resposta**:
  ```json
  {
    "jiraKey": "WMS-123",
    "issueUrl": "https://empresa.atlassian.net/browse/WMS-123",
    "issue": {
      "issueType": "Bug",
      "summary": "Impedir abertura do teclado virtual na tela de separação",
      "priority": "Medium",
      "labels": ["wms", "mobile", "scanner"]
    }
  }
  ```

---

## 🧪 Qualidade de Código (Linting)

Para rodar a verificação de sintaxe e padronização com o ESLint, use:
```bash
npm run lint
```
