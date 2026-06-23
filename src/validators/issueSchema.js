import { z } from "zod";

export const issueSchema = z.object({
  issueType: z.literal("Task"),
  summary: z.string().min(1, "O resumo não pode estar vazio"),
  priority: z.enum(["Highest", "High", "Medium", "Low", "Lowest"], {
    errorMap: () => ({ message: "A prioridade deve ser: Highest, High, Medium, Low ou Lowest" })
  }),
  labels: z.array(z.string()).default([]),
  description: z.string().min(1, "A descrição não pode estar vazia")
});
