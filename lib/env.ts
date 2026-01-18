import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_LLM_BASE_URL: z.string().url().default("http://localhost:5001"),
  NEXT_PUBLIC_MONITORING_BASE_URL: z
    .string()
    .url()
    .default("http://localhost:3000"),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_LLM_BASE_URL: process.env.NEXT_PUBLIC_LLM_BASE_URL,
  NEXT_PUBLIC_MONITORING_BASE_URL: process.env.NEXT_PUBLIC_MONITORING_BASE_URL,
});
