import axios from "axios";
import dotenv from "dotenv";
import { SYSTEM_PROMPT, getAnalyzePrompt } from "../prompts/jiraPrompt.js";

dotenv.config();

const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

/**
 * Envia o texto do usuário para a API do NVIDIA NIM e retorna um JSON estruturado com os dados da issue.
 * 
 * @param {string} userText - O texto livre digitado pelo usuário.
 * @returns {Promise<object>} O JSON estruturado com os dados mapeados para a issue do Jira.
 */
export async function analyzeTextWithNvidia(userText) {
  const apiKey = process.env.NVIDIA_API_KEY;

  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY não configurada no arquivo .env");
  }

  try {
    const response = await axios.post(
      NVIDIA_API_URL,
      {
        model: "meta/llama-3.1-70b-instruct",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: getAnalyzePrompt(userText) }
        ],
        temperature: 0.2
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        timeout: 60000 // Timeout de 60 segundos
      }
    );

    const content = response.data?.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("Resposta vazia retornada pelo modelo");
    }

    let cleanedContent = content.trim();
    if (cleanedContent.startsWith("```")) {
      cleanedContent = cleanedContent.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    }

    // Escape raw unescaped newlines inside JSON string values
    let insideString = false;
    let escapedContent = "";
    for (let i = 0; i < cleanedContent.length; i++) {
      const char = cleanedContent[i];
      if (char === '"') {
        let backslashes = 0;
        let j = i - 1;
        while (j >= 0 && cleanedContent[j] === '\\') {
          backslashes++;
          j--;
        }
        if (backslashes % 2 === 0) {
          insideString = !insideString;
        }
      }
      if (insideString && (char === '\n' || char === '\r')) {
        if (char === '\n') {
          escapedContent += '\\n';
        } else if (char === '\r') {
          if (cleanedContent[i + 1] === '\n') {
            continue;
          }
          escapedContent += '\\r';
        }
      } else {
        escapedContent += char;
      }
    }

    try {
      return JSON.parse(escapedContent);
    } catch (err) {
      console.error("Erro ao fazer parse do JSON retornado pelo NVIDIA NIM:", content);
      throw new Error(`JSON inválido retornado pelo modelo: ${content}`);
    }
  } catch (error) {
    if (error.code === "ECONNABORTED") {
      throw new Error("Timeout ao conectar com a API do NVIDIA NIM (limite de 60s excedido)");
    }

    if (error.response) {
      const status = error.response.status;
      if (status === 401) {
        throw new Error("Falha de autenticação na API do NVIDIA NIM (API Key inválida)");
      }
      if (status === 429) {
        throw new Error("Limite de requisições excedido na API do NVIDIA NIM (Rate Limit)");
      }
      throw new Error(`API do NVIDIA NIM retornou erro HTTP ${status}: ${error.response.statusText}`);
    }

    throw new Error(`Falha na comunicação com a API do NVIDIA NIM: ${error.message}`);
  }
}
