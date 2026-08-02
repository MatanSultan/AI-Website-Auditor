import { createHash } from "node:crypto";
import { z } from "zod";
import { config } from "@/lib/config";
import { getServerEnvironment } from "@/lib/env";

const baseUrl = config.paypalEnv === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
const captureSchema = z.object({ id: z.string(), status: z.string(), amount: z.object({ value: z.string(), currency_code: z.string() }) });
const orderSchema = z.object({
  id: z.string(), status: z.string(),
  purchase_units: z.array(z.object({
    reference_id: z.string().optional(), custom_id: z.string().optional(),
    amount: z.object({ value: z.string(), currency_code: z.string() }).optional(),
    payments: z.object({ captures: z.array(captureSchema).optional() }).optional(),
  })).min(1),
});
export type PayPalOrder = z.infer<typeof orderSchema>;

async function parseJson(response: Response): Promise<unknown> {
  try { return await response.json(); } catch { throw new Error("PAYPAL_INVALID_RESPONSE"); }
}

async function accessToken(): Promise<string> {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) throw new Error("PAYPAL_NOT_CONFIGURED");
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials", signal: AbortSignal.timeout(15_000) });
  const parsed = z.object({ access_token: z.string().min(1) }).safeParse(await parseJson(response));
  if (!response.ok || !parsed.success) throw new Error("PAYPAL_AUTH_FAILED");
  return parsed.data.access_token;
}

export function paymentRequestId(kind: "create" | "capture", auditId: string, orderId = ""): string {
  return createHash("sha256").update(`sitewise:${kind}:${auditId}:${orderId}`).digest("hex");
}

export async function createPayPalOrder(auditId: string, requestId = paymentRequestId("create", auditId)) {
  const token = await accessToken();
  const response = await fetch(`${baseUrl}/v2/checkout/orders`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": requestId }, body: JSON.stringify({ intent: "CAPTURE", purchase_units: [{ reference_id: auditId, custom_id: auditId, amount: { currency_code: config.reportPrice.currency, value: config.reportPrice.amount }, description: "AI Website Auditor — full report" }] }), signal: AbortSignal.timeout(20_000) });
  const parsed = z.object({ id: z.string().min(1), status: z.string() }).safeParse(await parseJson(response));
  if (!response.ok || !parsed.success) throw new Error("PAYPAL_CREATE_FAILED");
  return parsed.data;
}

export async function capturePayPalOrder(orderId: string, requestId: string): Promise<PayPalOrder> {
  const token = await accessToken();
  const response = await fetch(`${baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": requestId }, signal: AbortSignal.timeout(20_000) });
  const body = await parseJson(response);
  if (!response.ok) throw new Error(response.status === 422 ? "PAYPAL_CAPTURE_AMBIGUOUS" : "PAYPAL_CAPTURE_FAILED");
  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) throw new Error("PAYPAL_CAPTURE_AMBIGUOUS");
  return parsed.data;
}

export async function getPayPalOrder(orderId: string): Promise<PayPalOrder> {
  const token = await accessToken();
  const response = await fetch(`${baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}`, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(20_000) });
  const parsed = orderSchema.safeParse(await parseJson(response));
  if (!response.ok || !parsed.success) throw new Error("PAYPAL_RECONCILIATION_FAILED");
  return parsed.data;
}

export function verifyCapture(body: PayPalOrder, auditId: string) {
  const unit = body.purchase_units[0];
  const capture = unit.payments?.captures?.find((item) => item.status === "COMPLETED");
  const orderAmount = unit.amount;
  if (body.status !== "COMPLETED" || unit.reference_id !== auditId || unit.custom_id !== auditId || !capture ||
    capture.amount.value !== config.reportPrice.amount || capture.amount.currency_code !== config.reportPrice.currency ||
    orderAmount?.value !== config.reportPrice.amount || orderAmount.currency_code !== config.reportPrice.currency) throw new Error("PAYPAL_VERIFICATION_FAILED");
  return capture;
}

export async function captureOrReconcile(orderId: string, auditId: string): Promise<ReturnType<typeof verifyCapture>> {
  try {
    const captured = await capturePayPalOrder(orderId, paymentRequestId("capture", auditId, orderId));
    try { return verifyCapture(captured, auditId); } catch { /* reconcile any incomplete/ambiguous success body */ }
  } catch { /* reconcile network, invalid JSON and non-success responses */ }
  return verifyCapture(await getPayPalOrder(orderId), auditId);
}

export async function verifyPayPalWebhook(headers: Headers, event: unknown): Promise<boolean> {
  const environment = getServerEnvironment();
  if (!environment.paypalWebhookId) return false;
  const token = await accessToken();
  const response = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_algo: headers.get("paypal-auth-algo"), cert_url: headers.get("paypal-cert-url"), transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"), transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: environment.paypalWebhookId, webhook_event: event,
    }), signal: AbortSignal.timeout(15_000),
  });
  const parsed = z.object({ verification_status: z.string() }).safeParse(await parseJson(response));
  return response.ok && parsed.success && parsed.data.verification_status === "SUCCESS";
}
