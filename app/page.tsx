import Link from "next/link";
import { UrlStartForm } from "@/components/url-start-form";

const checks = [
  { num: "01", title: "חוויית משתמש והמרות", text: "האם ברור מה מציעים, למה לבחור בכם ומה לעשות עכשיו." },
  { num: "02", title: "נראות בגוגל", text: "האם מנועי חיפוש יכולים להבין ולהציג את העמודים הנכונים." },
  { num: "03", title: "מהירות במובייל", text: "היכן טעינה איטית או קפיצות במסך גורמות ללקוחות לנטוש." },
  { num: "04", title: "נגישות ואמון", text: "חסמים שמקשים על שימוש ופוגעים באמינות העסקית." },
];

export default function Home() {
  return <>
    <section className="hero"><div className="container hero-grid"><div className="hero-copy"><span className="eyebrow">בדיקת אתר מבוססת נתונים</span><h1>גלו מה באתר שלכם <em>עוצר לקוחות</em></h1><p className="lead">בדיקה מעשית של UX, קידום, מהירות ונגישות — עם סדר עדיפויות שמחובר להשפעה העסקית, לא עוד רשימת מושגים טכניים.</p><UrlStartForm/><div className="micro-trust"><span>ללא הרשמה</span><span>תוצאה ראשונית ללא עלות</span><span>עד 10 עמודים</span></div></div><aside className="audit-preview" aria-label="דוגמה לתוצאת בדיקה"><div className="preview-top"><div><span className="muted">ציון בריאות האתר</span><strong className="big-score">73</strong></div><span className="score-ring">73</span></div><div className="score-bars"><div><span>חוויית משתמש</span><i style={{width:"68%"}}/><b>68</b></div><div><span>SEO</span><i style={{width:"82%"}}/><b>82</b></div><div><span>ביצועים</span><i style={{width:"61%"}}/><b>61</b></div><div><span>נגישות</span><i style={{width:"79%"}}/><b>79</b></div></div><div className="preview-finding"><span className="severity-dot"/> <div><strong>הזדמנות מרכזית</strong><p>חידוד הפעולה הראשית וקיצור זמן הטעינה במובייל.</p></div></div></aside></div></section>
    <section className="proof-strip"><div className="container"><span>מתאים ל־</span><b>חנויות אונליין</b><b>עסקי שירות</b><b>צוותי שיווק</b><b>סוכנויות ובוני אתרים</b></div></section>
    <section className="section" id="how"><div className="container narrow"><span className="eyebrow">איך זה עובד</span><h2>מכתובת אתר לתוכנית פעולה</h2><div className="steps"><article><span>1</span><h3>משתפים כתובת והקשר</h3><p>כמה שאלות קצרות עוזרות לנו להבין מה האתר אמור להשיג.</p></article><article><span>2</span><h3>אנחנו בודקים את האתר</h3><p>סורקים עמודים מרכזיים ומצליבים תוכן, UX ומדדי ביצועים.</p></article><article><span>3</span><h3>מקבלים סדר עדיפויות</h3><p>רואים מה חשוב, למה, ומה כדאי לתקן קודם כדי להתקדם.</p></article></div></div></section>
    <section className="section warm" id="trust"><div className="container"><div className="section-heading"><div><span className="eyebrow">לא רק ציון</span><h2>כל ממצא מגיע עם הקשר וראיה</h2></div><p>אנחנו מפרידים בין בדיקות מדידות לבין פרשנות מקצועית, מסמנים רמת ביטחון ולא מבטיחים תוצאות שלא ניתן להבטיח.</p></div><div className="check-grid">{checks.map((check)=><article key={check.num}><span>{check.num}</span><h3>{check.title}</h3><p>{check.text}</p></article>)}</div></div></section>
    <section className="cta-section"><div className="container cta-box"><div><span className="eyebrow light">התחילו עכשיו</span><h2>האתר כבר מקבל תנועה. בואו נוודא שהוא עובד עבורה.</h2></div><Link className="button light-button" href="/audit/new">בדיקת אתר ללא עלות</Link></div></section>
  </>;
}

