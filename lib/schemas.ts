import { z } from "zod";

export const questionnaireSchema = z.object({
  siteType: z.enum(["ecommerce", "services", "content", "saas", "other"]),
  primaryGoal: z.enum(["sales", "leads", "traffic", "trust", "other"]),
  industry: z.string().trim().min(2).max(80),
  monthlyVisits: z.enum(["unknown", "0-1k", "1k-10k", "10k-50k", "50k+"]),
  conversionRate: z.number().min(0).max(100).nullable(),
  monthlyRevenue: z.enum(["unknown", "0-10k", "10k-50k", "50k-200k", "200k+"]),
  valuePerConversion: z.number().positive().max(10_000_000).nullable(),
});

export const auditCreateSchema = z.object({
  url: z.string().trim().min(1).max(2048),
  locale: z.enum(["he", "en"]).default("he"),
  questionnaire: questionnaireSchema,
});

export const findingSchema = z.object({
  id: z.string().uuid(),
  ruleId: z.string().min(1).max(200),
  category: z.enum(["ux", "seo", "performance", "accessibility"]),
  title: z.string().min(1),
  description: z.string().min(1),
  evidence: z.string().min(1),
  affectedUrl: z.string().url(),
  severity: z.enum(["critical", "high", "medium", "low"]),
  confidence: z.enum(["high", "medium", "low"]),
  impactType: z.enum(["conversion", "traffic", "trust", "accessibility", "performance"]),
  effort: z.enum(["quick", "medium", "project"]),
  recommendation: z.string().min(1),
  source: z.enum(["deterministic", "lighthouse", "ai_inference"]),
});

export const reportSchema = z.object({
  executiveSummary: z.string(),
  findings: z.array(findingSchema).max(40),
  quickWins: z.array(z.string()).max(8),
  thirtyDayPlan: z.array(z.object({ week: z.number().int().min(1).max(4), actions: z.array(z.string()) })),
});

export const leadSchema = z.object({
  auditId: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{8,20}$/),
  email: z.string().trim().email().max(160),
  websiteUrl: z.string().url(),
  consent: z.literal(true),
  company: z.string().max(0).optional(),
});

export type Finding = z.infer<typeof findingSchema>;
export type Questionnaire = z.infer<typeof questionnaireSchema>;
export type AuditReport = z.infer<typeof reportSchema>;
