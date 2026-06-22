import { z } from "zod";

const categories = [
  "Frontend", "Backend", "Mobile", "Integração", "Banco de Dados", 
  "Infraestrutura", "Segurança", "UX/UI", "Performance", "Relatórios", 
  "Automação", "Documentação", "DevOps", "Dados", "Outros"
];

const components = [
  "ERP", "WMS", "CRM", "Financeiro", "Comercial", "Compras", 
  "Estoque", "Faturamento", "Expedição", "Produção", "API", 
  "Portal", "Aplicativo", "Administrativo", "Integrações", "Outros"
];

export const issueSchema = z.object({
  issueType: z.enum(["Bug", "Story", "Task", "Improvement"], {
    errorMap: () => ({ message: "O tipo de issue deve ser: Bug, Story, Task ou Improvement" })
  }),
  summary: z.string().min(1, "O resumo não pode estar vazio"),
  priority: z.enum(["Highest", "High", "Medium", "Low", "Lowest"], {
    errorMap: () => ({ message: "A prioridade deve ser: Highest, High, Medium, Low ou Lowest" })
  }),
  category: z.enum(categories, {
    errorMap: () => ({ message: "Selecione uma categoria válida." })
  }),
  component: z.enum(components, {
    errorMap: () => ({ message: "Selecione um componente válido." })
  }),
  labels: z.array(z.string()).default([]),
  description: z.string().min(1, "A descrição não pode estar vazia")
});
