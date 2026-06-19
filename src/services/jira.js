import axios from "axios";
import dotenv from "dotenv";
import { convertMarkdownToAdf } from "../utils/adf.js";

dotenv.config();

/**
 * Cria um cliente Axios pré-configurado com autenticação Basic do Jira.
 */
function buildJiraClient(email, apiToken) {
  const authHeader = Buffer.from(`${email}:${apiToken}`).toString("base64");
  return axios.create({
    headers: {
      "Authorization": `Basic ${authHeader}`,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    timeout: 30000
  });
}

/**
 * Busca o ID do board associado ao projeto via Agile API.
 * Retorna null se não encontrar.
 *
 * @param {object} client - Axios instance
 * @param {string} baseUrl - URL base do Jira
 * @param {string} projectKey - Chave do projeto (ex: ERP)
 * @returns {Promise<number|null>}
 */
async function findBoardId(client, baseUrl, projectKey) {
  try {
    const res = await client.get(`${baseUrl}/rest/agile/1.0/board?projectKeyOrId=${projectKey}`);
    const board = res.data?.values?.[0];
    return board?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Move uma issue do backlog para o board usando a Agile API.
 * Isso coloca o card na primeira coluna do board (APROVAÇÃO).
 *
 * @param {object} client - Axios instance
 * @param {string} baseUrl - URL base do Jira
 * @param {number} boardId - ID do board
 * @param {string} issueKey - Chave da issue
 */
async function moveIssueToBoard(client, baseUrl, boardId, issueKey) {
  await client.post(`${baseUrl}/rest/agile/1.0/board/${boardId}/issue`, {
    issues: [issueKey]
  });
}

/**
 * Cria uma issue no Jira e a move automaticamente para a coluna "APROVAÇÃO" do board.
 *
 * @param {object} issueData - issueType, summary, priority, labels, description.
 * @returns {Promise<string>} A chave da issue criada (ex: "ERP-19").
 */
export async function createJiraIssue(issueData) {
  const jiraUrl = process.env.JIRA_URL;
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;
  const projectKey = process.env.JIRA_PROJECT_KEY;
  // ID do board (configurável via .env para evitar lookup a cada request)
  const boardIdEnv = process.env.JIRA_BOARD_ID ? Number(process.env.JIRA_BOARD_ID) : null;

  if (!jiraUrl || !email || !apiToken || !projectKey) {
    throw new Error("Configurações do Jira ausentes no arquivo .env (JIRA_URL, JIRA_EMAIL, JIRA_API_TOKEN ou JIRA_PROJECT_KEY)");
  }

  const baseUrl = jiraUrl.replace(/\/$/, "");
  const client = buildJiraClient(email, apiToken);
  const adfDescription = convertMarkdownToAdf(issueData.description);

  // Mapeamento de tipos de issue para o Jira em português
  const issueTypeMapping = {
    "Bug": "Bug",
    "Story": "História",
    "Task": "Tarefa",
    "Improvement": "Função"
  };

  const jiraIssueType = issueTypeMapping[issueData.issueType] || issueData.issueType;

  const payload = {
    fields: {
      project: { key: projectKey },
      summary: issueData.summary,
      issuetype: { name: jiraIssueType },
      priority: { name: issueData.priority },
      labels: issueData.labels || [],
      description: adfDescription
    }
  };

  try {
    // 1. Cria a issue (vai para backlog por padrão)
    const createRes = await client.post(`${baseUrl}/rest/api/3/issue`, payload);

    if (!createRes.data?.key) {
      throw new Error("A resposta da API do Jira não continha uma chave de issue válida");
    }

    const issueKey = createRes.data.key;
    console.log(`[Jira] Issue criada: ${issueKey}`);

    // 2. Busca o board ID (usa env se disponível, senão busca via API)
    const boardId = boardIdEnv ?? await findBoardId(client, baseUrl, projectKey);

    if (boardId) {
      // 3. Move do backlog para o board — coloca na primeira coluna (APROVAÇÃO)
      await moveIssueToBoard(client, baseUrl, boardId, issueKey);
      console.log(`[Jira] Issue ${issueKey} movida para o board (coluna APROVAÇÃO)`);
    } else {
      console.warn(`[Jira] Board não encontrado. Issue ${issueKey} permanece no backlog.`);
    }

    return issueKey;
  } catch (error) {
    if (error.code === "ECONNABORTED") {
      throw new Error("Timeout ao conectar com o Jira (limite de 30s excedido)");
    }

    if (error.response) {
      const status = error.response.status;
      if (status === 401 || status === 403) {
        throw new Error("Falha de autenticação no Jira (Verifique o email e o API Token no .env)");
      }
      if (status === 400) {
        console.error("Erro detalhado do Jira:", JSON.stringify(error.response.data));
        const errors = error.response.data?.errors;
        let errorMessage = "Dados inválidos enviados ao Jira.";
        if (errors) {
          errorMessage += " Detalhes: " + Object.entries(errors).map(([k, v]) => `${k}: ${v}`).join(", ");
        } else if (error.response.data?.errorMessages?.length) {
          errorMessage += " Detalhes: " + error.response.data.errorMessages.join(", ");
        }
        throw new Error(errorMessage);
      }
      if (status === 429) {
        throw new Error("Limite de requisições excedido no Jira (Rate Limit)");
      }
      throw new Error(`Jira retornou erro HTTP ${status}: ${error.response.statusText}`);
    }

    throw new Error(`Falha na comunicação com o Jira: ${error.message}`);
  }
}
