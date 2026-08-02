"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function UrlStartForm() {
  const router = useRouter(); const [url, setUrl] = useState(""); const [error, setError] = useState("");
  function submit(event: FormEvent) { event.preventDefault(); setError(""); try { const value = url.trim(); if (!value || (!value.includes(".") && !value.startsWith("http"))) throw new Error(); router.push(`/audit/new?url=${encodeURIComponent(value)}`); } catch { setError("הזינו כתובת אתר תקינה, למשל example.co.il"); } }
  return <form className="url-form" onSubmit={submit} noValidate><label htmlFor="hero-url">כתובת האתר לבדיקה</label><div className="url-field"><span aria-hidden="true">https://</span><input id="hero-url" type="text" inputMode="url" autoComplete="url" placeholder="your-site.co.il" value={url} onChange={(event)=>setUrl(event.target.value)} aria-describedby={error?"hero-url-error":"hero-url-note"} aria-invalid={Boolean(error)}/><button type="submit">בדקו את האתר <span aria-hidden="true">←</span></button></div>{error?<p className="form-error" id="hero-url-error">{error}</p>:<p className="field-note" id="hero-url-note">הבדיקה הראשונית ללא עלות וללא צורך בכרטיס אשראי.</p>}</form>;
}

