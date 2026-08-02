"use client";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function AuditForm({ demoMode }: { demoMode: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const payload = {
      url: data.get("url"),
      locale: "he",
      questionnaire: {
        siteType: data.get("siteType"),
        primaryGoal: data.get("primaryGoal"),
        industry: data.get("industry"),
        monthlyVisits: data.get("monthlyVisits"),
        conversionRate: data.get("conversionRate")
          ? Number(data.get("conversionRate"))
          : null,
        monthlyRevenue: data.get("monthlyRevenue"),
        valuePerConversion: data.get("valuePerConversion")
          ? Number(data.get("valuePerConversion"))
          : null,
      },
    };
    try {
      const response = await fetch("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { id?: string; error?: string; completed?: boolean };
      if (!response.ok || !body.id) throw new Error(body.error);
      router.push(`/audit/${body.id}/${body.completed ? "results" : "progress"}`);
    } catch {
      setError("לא הצלחנו להתחיל את הבדיקה. בדקו את הכתובת ונסו שוב.");
      setPending(false);
    }
  }
  return (
    <form className="panel questionnaire" onSubmit={submit}>
      <div className="field full">
        <label htmlFor="url">כתובת האתר</label>
        <input
          id="url"
          name="url"
          type="text"
          inputMode="url"
          required
          defaultValue={params.get("url") ?? "https://demo-shop.co.il"}
        />
      </div>
      <div className="field">
        <label htmlFor="siteType">סוג האתר</label>
        <select id="siteType" name="siteType" defaultValue="ecommerce">
          <option value="ecommerce">חנות אונליין</option>
          <option value="services">אתר שירותים</option>
          <option value="content">תוכן / מדיה</option>
          <option value="saas">מוצר דיגיטלי / SaaS</option>
          <option value="other">אחר</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="primaryGoal">המטרה המרכזית</label>
        <select id="primaryGoal" name="primaryGoal">
          <option value="sales">מכירות</option>
          <option value="leads">קבלת לידים</option>
          <option value="traffic">תנועה אורגנית</option>
          <option value="trust">חיזוק אמון</option>
          <option value="other">אחר</option>
        </select>
      </div>
      <div className="field full">
        <label htmlFor="industry">תחום פעילות</label>
        <input
          id="industry"
          name="industry"
          required
          minLength={2}
          placeholder="לדוגמה: ריהוט ועיצוב הבית"
        />
      </div>
      <div className="field">
        <label htmlFor="monthlyVisits">כניסות חודשיות</label>
        <select id="monthlyVisits" name="monthlyVisits" defaultValue="unknown">
          <option value="unknown">לא יודע</option>
          <option value="0-1k">עד 1,000</option>
          <option value="1k-10k">1,000–10,000</option>
          <option value="10k-50k">10,000–50,000</option>
          <option value="50k+">מעל 50,000</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="conversionRate">שיעור המרה, אם ידוע (%)</label>
        <input
          id="conversionRate"
          name="conversionRate"
          type="number"
          min="0"
          max="100"
          step="0.1"
          placeholder="לא יודע"
        />
      </div>
      <div className="field">
        <label htmlFor="monthlyRevenue">הכנסה חודשית</label>
        <select
          id="monthlyRevenue"
          name="monthlyRevenue"
          defaultValue="unknown"
        >
          <option value="unknown">לא יודע</option>
          <option value="0-10k">עד ₪10,000</option>
          <option value="10k-50k">₪10,000–50,000</option>
          <option value="50k-200k">₪50,000–200,000</option>
          <option value="200k+">מעל ₪200,000</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="valuePerConversion">שווי הזמנה או ליד (₪)</label>
        <input
          id="valuePerConversion"
          name="valuePerConversion"
          type="number"
          min="1"
          placeholder="לא יודע"
        />
      </div>
      {error && (
        <p className="form-error full" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions full">
        <p>
          {demoMode
            ? "מצב הדגמה: לא מתבצעת סריקה חיצונית אמיתית, והפרטים שתשלחו — כולל פרטי ליד — אינם נשמרים במסד נתונים או ב־CRM."
            : "הנתונים נשמרים לצורך ביצוע הבדיקה ובהתאם למדיניות הפרטיות."}
        </p>
        <button className="button" disabled={pending}>
          {pending ? "מתחילים…" : "התחילו את הבדיקה"}
        </button>
      </div>
    </form>
  );
}
