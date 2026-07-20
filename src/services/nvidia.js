import axios from "axios";
import dotenv from "dotenv";
import { SYSTEM_PROMPT, getAnalyzePrompt } from "../prompts/jiraPrompt.js";

dotenv.config();

const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

function escapeLiteralQuotesInJson(jsonStr) {
  let result = "";
  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];
    if (char === '"') {
      let backslashes = 0;
      let j = i - 1;
      while (j >= 0 && jsonStr[j] === '\\') {
        backslashes++;
        j--;
      }
      if (backslashes % 2 !== 0) {
        result += char;
        continue;
      }
      
      let prevStr = jsonStr.substring(0, i).trim();
      let lastChar = prevStr[prevStr.length - 1];
      
      let nextStr = jsonStr.substring(i + 1).trim();
      let nextChar = nextStr[0];
      
      let isStructural = false;
      if (i === 0 || i === jsonStr.length - 1) {
        isStructural = true;
      } else if (lastChar === '{' || lastChar === '[' || lastChar === ',') {
        isStructural = true;
      } else if (lastChar === ':') {
        // A structural colon must be preceded by a key (which ends with a double quote)
        let beforeColon = prevStr.substring(0, prevStr.length - 1).trim();
        if (beforeColon[beforeColon.length - 1] === '"') {
          isStructural = true;
        }
      } else if (nextChar === '}' || nextChar === ']') {
        isStructural = true;
      } else if (nextChar === ',') {
        // Verify if the comma is followed by a new key (starts with ") or end of block (} or ])
        let afterComma = nextStr.substring(1).trim();
        let firstNonWhitespace = afterComma[0];
        if (firstNonWhitespace === '"' || firstNonWhitespace === '}' || firstNonWhitespace === ']') {
          isStructural = true;
        }
      } else if (nextChar === ':') {
        // Verify if the colon is followed by a value start
        let afterColon = nextStr.substring(1).trim();
        let firstNonWhitespace = afterColon[0];
        if (
          firstNonWhitespace === '"' || 
          firstNonWhitespace === '[' || 
          firstNonWhitespace === '{' || 
          firstNonWhitespace === 't' || // true
          firstNonWhitespace === 'f' || // false
          firstNonWhitespace === 'n' || // null
          (firstNonWhitespace >= '0' && firstNonWhitespace <= '9') ||
          firstNonWhitespace === '-'
        ) {
          isStructural = true;
        }
      }
      
      if (isStructural) {
        result += char;
      } else {
        result += '\\"';
      }
    } else {
      result += char;
    }
  }
  return result;
}

function repairTruncatedJson(jsonStr) {
  let cleaned = jsonStr.trim();
  if (!cleaned.startsWith('{')) {
    return jsonStr;
  }

  // Count unescaped double quotes to fix unclosed strings
  let insideString = false;
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '"') {
      let backslashes = 0;
      let j = i - 1;
      while (j >= 0 && cleaned[j] === '\\') {
        backslashes++;
        j--;
      }
      if (backslashes % 2 === 0) {
        insideString = !insideString;
      }
    }
  }

  if (insideString) {
    cleaned += '"';
  }

  // Remove trailing commas or dangling key/value pairs if truncated mid-property
  cleaned = cleaned.replace(/,\s*$/, "");
  cleaned = cleaned.replace(/,\s*"[^"]*"\s*:\s*$/, "");
  cleaned = cleaned.replace(/{\s*"[^"]*"\s*:\s*$/, "{");

  // Balance braces and brackets
  let openBraces = 0;
  let openBrackets = 0;
  insideString = false;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (char === '"') {
      let backslashes = 0;
      let j = i - 1;
      while (j >= 0 && cleaned[j] === '\\') {
        backslashes++;
        j--;
      }
      if (backslashes % 2 === 0) {
        insideString = !insideString;
      }
    }
    if (!insideString) {
      if (char === '{') openBraces++;
      if (char === '}') openBraces = Math.max(0, openBraces - 1);
      if (char === '[') openBrackets++;
      if (char === ']') openBrackets = Math.max(0, openBrackets - 1);
    }
  }

  while (openBrackets > 0) {
    cleaned += ']';
    openBrackets--;
  }
  while (openBraces > 0) {
    cleaned += '}';
    openBraces--;
  }

  return cleaned;
}

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
        model: "meta/llama-3.1-8b-instruct",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: getAnalyzePrompt(userText) }
        ],
        temperature: 0.2,
        max_tokens: 4096
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
    console.log("RAW CONTENT FROM MODEL:", JSON.stringify(content));
    
    if (!content) {
      throw new Error("Resposta vazia retornada pelo modelo");
    }

    let cleanedContent = content.trim();
    cleanedContent = cleanedContent.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

    const firstBrace = cleanedContent.indexOf('{');
    if (firstBrace !== -1) {
      cleanedContent = cleanedContent.substring(firstBrace);
      const lastBrace = cleanedContent.lastIndexOf('}');
      if (lastBrace !== -1) {
        cleanedContent = cleanedContent.substring(0, lastBrace + 1);
      }
    }

    cleanedContent = repairTruncatedJson(cleanedContent);

    // First, escape literal unescaped double quotes inside the JSON string
    cleanedContent = escapeLiteralQuotesInJson(cleanedContent);

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
      console.error("Erro ao fazer parse do JSON retornado pelo NVIDIA NIM. Erro:", err.message);
      console.error("Conteúdo original:", content);
      console.error("Conteúdo processado (escapedContent):", escapedContent);
      throw new Error(`JSON inválido retornado pelo modelo: ${err.message}. Original: ${content}`);
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
