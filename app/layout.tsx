import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { config } from "@/lib/config";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(process.env.APP_BASE_URL ?? `${protocol}://${host}`);
  const title = "SiteWise — בדיקת אתר שמחוברת לתוצאה העסקית";
  const description = "בדיקת אתר חכמה שמזהה מה עוצר לקוחות, תנועה והכנסות — ומתרגמת את הממצאים לתוכנית עבודה ברורה.";
  return { metadataBase, title: { default: title, template: "%s | SiteWise" }, description, icons: { icon: "/favicon.svg" }, openGraph: { type: "website", locale: "he_IL", title, description, images: [{ url: "/og.png", width: 1792, height: 935, alt: "SiteWise — גלו מה באתר שלכם עוצר לקוחות" }] }, twitter: { card: "summary_large_image", title, description, images: ["/og.png"] } };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="he" dir="rtl" data-scroll-behavior="smooth"><body>
    <a className="skip-link" href="#main">דלגו לתוכן המרכזי</a>
    {config.demoMode && <div className="demo-banner" role="status"><strong>מצב הדגמה</strong><span>הבדיקה משתמשת בנתוני דוגמה מקומיים. תשלום אמיתי אינו זמין.</span></div>}
    <header className="site-header"><div className="container header-inner"><Link href="/" className="brand" aria-label="SiteWise דף הבית"><span className="brand-mark" aria-hidden="true">S</span><span>SiteWise</span></Link><nav aria-label="ניווט ראשי"><Link href="/#how">איך זה עובד</Link><Link href="/#trust">מה בודקים</Link><Link href="/audit/new" className="nav-cta">בדיקת אתר</Link></nav></div></header>
    <main id="main">{children}</main>
    <footer><div className="container footer-inner"><div><span className="brand"><span className="brand-mark">S</span><span>SiteWise</span></span><p>החלטות טובות יותר מתחילות באתר שמבינים.</p></div><nav aria-label="קישורים משפטיים"><Link href="/privacy">פרטיות</Link><Link href="/terms">תנאי שימוש</Link><Link href="/accessibility">נגישות</Link></nav><small>© {new Date().getFullYear()} SiteWise</small></div></footer>
  </body></html>;
}
