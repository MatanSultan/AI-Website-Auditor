export const config = {
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-5-mini",
  promptVersion: "audit-v1.0.0",
  maxPages: 10,
  pageSpeedPages: 3,
  reportPrice: { amount: "69.00", currency: "ILS" },
  demoMode:
    process.env.DEMO_MODE === "true" ||
    !process.env.FIRECRAWL_API_KEY ||
    !process.env.PAGESPEED_API_KEY ||
    !process.env.OPENAI_API_KEY,
  paypalConfigured: Boolean(
    process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET,
  ),
} as const;

