import { logEvent } from "@/lib/api/errors";
import { getServerEnvironment, type ValidatedEnvironment } from "@/lib/env";
import { GroqAIProvider } from "@/lib/providers/ai/groq";
import { OpenAIProvider } from "@/lib/providers/ai/openai";
import {
  AIAnalysisError,
  type AIProviderAdapter,
  type AIReportInput,
} from "@/lib/providers/ai/shared";
import type { AuditReport } from "@/lib/schemas";

export { AIAnalysisError } from "@/lib/providers/ai/shared";
export type { AIReportInput } from "@/lib/providers/ai/shared";

type AIRequestContext = { auditId?: string; jobId?: string };
type AIProviderFactory = (environment: ValidatedEnvironment, context?: AIRequestContext) => AIProviderAdapter;

function defaultProviderFactory(environment: ValidatedEnvironment, context?: AIRequestContext): AIProviderAdapter {
  const onRetry = ({ attempt, durationMs }: { attempt: number; durationMs: number }) => logEvent({
    auditId: context?.auditId,
    jobId: context?.jobId,
    provider: environment.aiProvider ?? undefined,
    stage: "analysis_retry",
    code: "AI_RETRY",
    attempt,
    durationMs,
  });
  if (environment.aiProvider === "groq") {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || !environment.aiModel) throw new AIAnalysisError("groq");
    return new GroqAIProvider({ apiKey, model: environment.aiModel }, { onRetry });
  }
  if (environment.aiProvider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || !environment.aiModel) throw new AIAnalysisError("openai");
    return new OpenAIProvider({ apiKey, model: environment.aiModel }, { onRetry });
  }
  throw new AIAnalysisError("none");
}

export async function buildStructuredReport(
  input: AIReportInput,
  context?: AIRequestContext,
  dependencies: { environment?: ValidatedEnvironment; createProvider?: AIProviderFactory } = {},
): Promise<AuditReport> {
  const environment = dependencies.environment ?? getServerEnvironment();
  if (environment.demoMode || !environment.aiConfigured) throw new AIAnalysisError("none");
  const provider = (dependencies.createProvider ?? defaultProviderFactory)(environment, context);
  return provider.buildStructuredReport(input);
}
