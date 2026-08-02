import { DEFAULT_GROQ_MODEL, DEFAULT_OPENAI_MODEL } from "@/lib/env";

const aiProvider = process.env.AI_PROVIDER === "groq" || process.env.AI_PROVIDER === "openai"
  ? process.env.AI_PROVIDER
  : undefined;

export const config = {
  demoMode: process.env.DEMO_MODE === "true",
  appMode: process.env.DEMO_MODE === "true" ? "DEMO" : process.env.APP_ENV ?? "SANDBOX",
  aiProvider,
  aiModel: aiProvider === "groq"
    ? process.env.GROQ_MODEL ?? DEFAULT_GROQ_MODEL
    : process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
  paypalEnv: process.env.PAYPAL_ENV === "live" ? "live" : "sandbox",
  paypalConfigured: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET && process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID && process.env.PAYPAL_WEBHOOK_ID),
  promptVersion: "audit-v1.0.0",
  maxPages: 10,
  pageSpeedPages: 3,
  reportPrice: { amount: "69.00", currency: "ILS" },
} as const;
