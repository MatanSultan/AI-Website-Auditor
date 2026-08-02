import { Suspense } from "react";
import { AuditForm } from "@/components/audit-form";
import { config } from "@/lib/config";
export default function NewAuditPage(){return <section className="form-page"><div className="container form-shell"><div className="form-intro"><span className="eyebrow">שלב 1 מתוך 1</span><h1>קצת הקשר, כדי שהבדיקה תהיה שימושית</h1><p>הנתונים עוזרים לנו לתרגם בעיות באתר להשפעה אפשרית. אפשר לבחור “לא יודע” בכל נתון שאינו זמין.</p></div><Suspense fallback={<div className="panel">טוענים את השאלון…</div>}><AuditForm demoMode={config.demoMode}/></Suspense></div></section>}
