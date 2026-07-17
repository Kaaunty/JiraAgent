import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import issueRouter from "./routes/issue.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware para Timeout Global de 60 segundos
app.use((req, res, next) => {
  res.setTimeout(60000, () => {
    if (!res.headersSent) {
      res.status(503).json({ error: "Tempo limite de requisição excedido (Timeout de 60s)" });
    }
  });
  next();
});

// Middlewares padrões
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logs de requisições simples
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Servir arquivos estáticos do frontend (localizados em src/public)
app.use(express.static(path.join(__dirname, "public")));

// Endpoint de Health Check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Rotas da API
app.use("/api/issue", issueRouter);

// Middleware Global de Erros
app.use((err, req, res, _next) => {
  console.error(`[Erro] ${err.stack || err.message}`);

  // Limpa tokens ou credenciais que possam aparecer na mensagem de erro
  let cleanMessage = err.message || "Erro interno do servidor";
  cleanMessage = cleanMessage
    .replace(/Basic\s+[A-Za-z0-9+/=]+/g, "Basic [RETACTED]")
    .replace(/Bearer\s+[A-Za-z0-9-_.]+/g, "Bearer [REDACTED]");

  // Determinar status code
  let statusCode = 500;
  if (err.message.includes("autenticação") || err.message.includes("auth")) {
    statusCode = 401;
  } else if (err.message.includes("timeout") || err.message.includes("Timeout")) {
    statusCode = 504;
  } else if (err.message.includes("Zod") || err.message.includes("dados de entrada")) {
    statusCode = 400;
  } else if (err.message.includes("limite de requisições") || err.message.includes("Rate Limit")) {
    statusCode = 429;
  }

  if (!res.headersSent) {
    res.status(statusCode).json({
      error: cleanMessage
    });
  }
});

// Inicialização do Servidor
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(` Servidor rodando em http://localhost:${PORT}`);
  console.log(` Health check em http://localhost:${PORT}/health`);
  console.log(`==================================================`);
});
