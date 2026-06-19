import axios from "axios";
import dotenv from "dotenv";
import { SYSTEM_PROMPT, getAnalyzePrompt } from "../prompts/jiraPrompt.js";

dotenv.config();

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

/**
 * Envia o texto do usuário para a API do DeepSeek e retorna um JSON estruturado com os dados da issue.
 * 
 * @param {string} userText - O texto livre digitado pelo usuário.
 * @returns {Promise<object>} O JSON estruturado com os dados mapeados para a issue do Jira.
 */
export async function analyzeTextWithDeepSeek(userText) {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY não configurada no arquivo .env");
  }

  try {
    const response = await axios.post(
      DEEPSEEK_API_URL,
      {
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: getAnalyzePrompt(userText) }
        ],
        temperature: 0.2,
        response_format: {
          type: "json_object"
        }
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        timeout: 30000 // Timeout de 30 segundos
      }
    );

    const content = response.data?.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("Resposta vazia retornada pelo modelo");
    }

    try {
      return JSON.parse(content);
    } catch {
      console.error("Erro ao fazer parse do JSON retornado pelo DeepSeek:", content);
      throw new Error("JSON inválido retornado pelo modelo");
    }
  } catch (error) {
    if (error.code === "ECONNABORTED") {
      throw new Error("Timeout ao conectar com a API do DeepSeek (limite de 30s excedido)");
    }

    if (error.response) {
      const status = error.response.status;
      if (status === 401) {
        throw new Error("Falha de autenticação na API do DeepSeek (API Key inválida)");
      }
      if (status === 429) {
        throw new Error("Limite de requisições excedido na API do DeepSeek (Rate Limit)");
      }
      throw new Error(`API do DeepSeek retornou erro HTTP ${status}: ${error.response.statusText}`);
    }

    throw new Error(`Falha na comunicação com o DeepSeek: ${error.message}`);
  }
}
