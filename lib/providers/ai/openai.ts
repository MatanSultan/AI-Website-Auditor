import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { reportSchema, type AuditReport } from "@/lib/schemas";
import {
  AIAnalysisError,
  AI_REQUEST_TIMEOUT_MS,
  SYSTEM_PROMPT,
  serializeAIInput,
  withAIRetry,
  type AIProviderAdapter,
  type AIReportInput,
  type AIRetryOptions,
} from "@/lib/providers/ai/shared";

type ResponsesClient = Pick<OpenAI, "responses">;

export type OpenAIProviderDependencies = AIRetryOptions & { client?: ResponsesClient };

export class OpenAIProvider implements AIProviderAdapter {
  private readonly client: ResponsesClient;

  constructor(
    private readonly settings: { apiKey: string; model: string },
    private readonly dependencies: OpenAIProviderDependencies = {},
  ) {
    this.client = dependencies.client ?? new OpenAI({
      apiKey: settings.apiKey,
      timeout: AI_REQUEST_TIMEOUT_MS,
      maxRetries: 0,
    });
  }

  async buildStructuredReport(input: AIReportInput): Promise<AuditReport> {
    try {
      return await withAIRetry(async () => {
        const response = await this.client.responses.parse({
          model: this.settings.model,
          max_output_tokens: 4_500,
          input: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: serializeAIInput(input) },
          ],
          text: { format: zodTextFormat(reportSchema, "website_audit_report") },
        });
        if (!response.output_parsed) throw new Error("AI_SCHEMA_PARSE_FAILED");
        return reportSchema.parse(response.output_parsed);
      }, this.dependencies);
    } catch {
      throw new AIAnalysisError("openai");
    }
  }
}
