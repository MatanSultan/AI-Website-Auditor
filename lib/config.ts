import { validateEnvironment } from "@/lib/env";

const environment = validateEnvironment(process.env);

export const config = {
  ...environment,
  promptVersion: "audit-v1.0.0",
  maxPages: 10,
  pageSpeedPages: 3,
  reportPrice: { amount: "69.00", currency: "ILS" },
} as const;
