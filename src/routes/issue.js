import { Router } from "express";
import { analyzeTextWithNvidia } from "../services/nvidia.js";
import { createJiraIssue } from "../services/jira.js";
import { issueSchema } from "../validators/issueSchema.js";

const router = Router();

/**
 * Rota: POST /api/issue/analyze
 * Recebe o texto livre do usuário e retorna a estrutura JSON gerada pelo DeepSeek.
 */
router.post("/analyze", async (req, res, next) => {
  const { texto } = req.body;

  if (!texto || typeof texto !== "string" || texto.trim() === "") {
    return res.status(400).json({ error: "O campo 'texto' é obrigatório e deve ser uma string válida." });
  }

  try {
    // 1. Envia texto para o NVIDIA NIM estruturar
    const aiResponse = await analyzeTextWithNvidia(texto);

    // 2. Valida o JSON retornado utilizando o Zod
    const validationResult = issueSchema.safeParse(aiResponse);

    if (!validationResult.success) {
      console.error("Resposta do NVIDIA NIM inválida de acordo com o Zod:", validationResult.error.format());
      return res.status(422).json({ error: "Invalid AI response" });
    }

    // 3. Retorna os dados estruturados para que a tela permita edição
    return res.json(validationResult.data);
  } catch (error) {
    return next(error);
  }
});

/**
 * Rota: POST /api/issue
 * Recebe os dados validados (e possivelmente editados pela UI) e cria a issue no Jira.
 */
router.post("/", async (req, res, next) => {
  // 1. Valida os dados de entrada
  const validationResult = issueSchema.safeParse(req.body);

  if (!validationResult.success) {
    const errorDetails = validationResult.error.errors.map(err => `${err.path.join(".")}: ${err.message}`).join(", ");
    return res.status(400).json({ error: `Dados de entrada inválidos: ${errorDetails}` });
  }

  try {
    const issueData = validationResult.data;

    // 2. Cria a issue no Jira
    const jiraKey = await createJiraIssue(issueData);

    // Constrói a URL para abrir a issue diretamente no Jira Cloud
    const cleanJiraUrl = (process.env.JIRA_URL || "").replace(/\/$/, "");
    const issueUrl = `${cleanJiraUrl}/browse/${jiraKey}`;

    // 3. Retorna a resposta conforme o exemplo solicitado
    return res.status(201).json({
      jiraKey,
      issueUrl,
      issue: {
        issueType: issueData.issueType,
        summary: issueData.summary,
        priority: issueData.priority,
        labels: issueData.labels
      }
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
