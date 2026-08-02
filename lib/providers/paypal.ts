import { config } from "@/lib/config";

const baseUrl = process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
async function accessToken(): Promise<string> {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) throw new Error("PAYPAL_NOT_CONFIGURED");
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
  if (!response.ok) throw new Error("PAYPAL_AUTH_FAILED"); return (await response.json() as { access_token: string }).access_token;
}
export async function createPayPalOrder(auditId: string, requestId: string) {
  const token = await accessToken(); const response = await fetch(`${baseUrl}/v2/checkout/orders`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": requestId }, body: JSON.stringify({ intent: "CAPTURE", purchase_units: [{ reference_id: auditId, custom_id: auditId, amount: { currency_code: config.reportPrice.currency, value: config.reportPrice.amount }, description: "AI Website Auditor — דוח מלא" }] }) });
  if (!response.ok) throw new Error("PAYPAL_CREATE_FAILED"); return response.json() as Promise<{ id: string; status: string }>;
}
export async function capturePayPalOrder(orderId: string, requestId: string) {
  const token = await accessToken(); const response = await fetch(`${baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": requestId } });
  const body = await response.json() as { id: string; status: string; purchase_units?: Array<{ reference_id?: string; payments?: { captures?: Array<{ id: string; status: string; amount: { value: string; currency_code: string } }> } }> };
  if (!response.ok && response.status !== 422) throw new Error("PAYPAL_CAPTURE_FAILED"); return body;
}
export function verifyCapture(body: Awaited<ReturnType<typeof capturePayPalOrder>>, auditId: string) {
  const unit = body.purchase_units?.[0]; const capture = unit?.payments?.captures?.[0];
  if (body.status !== "COMPLETED" || unit?.reference_id !== auditId || capture?.status !== "COMPLETED" || capture.amount.value !== config.reportPrice.amount || capture.amount.currency_code !== config.reportPrice.currency) throw new Error("PAYPAL_VERIFICATION_FAILED");
  return capture;
}

