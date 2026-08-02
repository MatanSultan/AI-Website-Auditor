# AI Website Auditor (SiteWise)

## Vercel production readiness (v0.2.0)

SANDBOX/LIVE audits use signed QStash callbacks, owner-specific PostgreSQL leases, and shared Upstash Redis rate limits. With `DEMO_MODE=true`, audit identities are short-lived and HMAC-signed with a deployment-scoped build key, so Vercel functions can reconstruct an immediate fixture result without shared memory or external infrastructure.

Use a pooled Neon URL in `DATABASE_URL` for runtime traffic and a direct Neon URL in `DIRECT_URL` for Prisma migrations. `DEMO_MODE=false` requires `APP_ENV=SANDBOX|LIVE`, an HTTPS `APP_BASE_URL`, queue/Redis/cron credentials, Firecrawl, PageSpeed, OpenAI, and an exact 32-byte Base64 report key. PayPal values are optional only as a complete group; LIVE requires PayPal Live.

```bash
npm run env:validate
npm run db:validate
npm run verify:production
```

`verify:production` rejects Demo Mode, checks migration status on the configured database, and runs lint, type checking, unit tests, optional isolated PostgreSQL integration tests (`TEST_DATABASE_URL`), build, and E2E. It never applies migrations or deploys. Apply reviewed migrations separately with `npm run db:migrate:deploy`.

`npm run smoke:providers` makes real Firecrawl, PageSpeed and OpenAI calls only for the explicitly approved `SMOKE_TEST_URL` and consumes quota. PayPal requires a separate manual Sandbox capture/webhook test. See [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) and [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md).

MVP מלא לבדיקת אתרים בעברית: סריקה של עד 10 עמודים, PageSpeed במובייל, ניתוח מובנה באמצעות OpenAI, תוצאה ציבורית מוגבלת, דוח בתשלום ולכידת לידים.

## התקנה

דרישות: Node.js 24.x, PostgreSQL 15+ ו־npm.

```bash
npm install
cp .env.example .env
npm run db:generate
npm run db:migrate
npm run dev
```

ללא מפתחות ספקים אפשר להגדיר `DEMO_MODE=true`. מצב זה משתמש ב־fixtures מקומיים, מציג banner ברור, מחזיר תוצאה מיידית ואינו מדמה סריקה חיצונית או תשלום מוצלח. מזהי ההדגמה תקפים לשעה ולפריסה שבה נוצרו. ליד שנשלח במצב זה מאומת ומתקבל לצורך בדיקת הזרימה בלבד, אך אינו נשמר במסד נתונים או ב־CRM.

## משתני סביבה

- `DATABASE_URL` — חיבור PostgreSQL של Prisma. הוא אינו נדרש ב־Demo הסטטלס, ונדרש ללא fallback בכל SANDBOX/LIVE.
- `REPORT_ENCRYPTION_KEY` — סוד להצפנת דוח מלא, מומלץ 32 בתים אקראיים ב־Base64.
- `APP_BASE_URL` — כתובת האפליקציה.
- `FIRECRAWL_API_KEY` — מפתח Firecrawl.
- `PAGESPEED_API_KEY` — מפתח Google PageSpeed Insights.
- `OPENAI_API_KEY` — מפתח OpenAI בצד השרת בלבד.
- `OPENAI_MODEL` — מודל Responses API; ברירת המחדל מרוכזת ב־`lib/config.ts`.
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` — credentials ל־Orders REST API בצד השרת.
- `NEXT_PUBLIC_PAYPAL_CLIENT_ID` — Client ID ציבורי ל־PayPal JavaScript SDK.
- `PAYPAL_ENV` — `sandbox` או `live`.
- `DEMO_MODE` — כופה fixtures מקומיים.

## Prisma ו־PostgreSQL

```bash
npm run db:generate
npm run db:migrate
```

ב־CI/production יש להריץ `npx prisma migrate deploy` לפני עליית האפליקציה. ה־schema כולל Audit, AuditPage, Finding, Lead, Payment ו־AuditEvent.

## ספקים

### Firecrawl

צרו מפתח, הגדירו `FIRECRAWL_API_KEY`. ה־adapter משתמש ב־Map לבחירת מועמדים וב־Scrape לתוכן Markdown מצומצם, מגביל עמודים ומטפל ב־retry מוגבל. אין שימוש ב־`ignoreRobotsTxt`.

### PageSpeed Insights

הפעילו PageSpeed Insights API בפרויקט Google Cloud והגדירו `PAGESPEED_API_KEY`. הבדיקה רצה על mobile, בעמוד הבית ועד שני עמודים מייצגים נוספים.

### OpenAI

הגדירו `OPENAI_API_KEY` ו־`OPENAI_MODEL`. היישום משתמש ב־Responses API, Structured Outputs ו־Zod. תוכן האתר מוכנס כנתון לא־מהימן, מקוצר ומופרד מהוראות המערכת.

### PayPal Sandbox

צרו אפליקציית Sandbox ב־PayPal Developer, הגדירו את ארבעת משתני PayPal והשתמשו בחשבון Sandbox לקונה. Order נוצר ונלכד בשרת; סכום, מטבע, סטטוס, audit binding וכפילויות נבדקים לפני פתיחת הדוח. ללא credentials הכפתור מושבת.

## בדיקות ובנייה

```bash
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

## Deployment

Production configuration is validated at startup and has no memory-store fallback. Set `DEMO_MODE=false`, PostgreSQL and all provider credentials. Generate the report key with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`; never reuse example text. PayPal additionally requires `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, and `PAYPAL_WEBHOOK_ID`.

Encrypted reports use `REPORT_ENCRYPTION_KEY_VERSION`. During rotation, old version-to-key mappings may be supplied as JSON in `REPORT_ENCRYPTION_PREVIOUS_KEYS`. Run `npm run cleanup` on a schedule to clear expired extracted content and expired unpaid audits.

1. ספקו PostgreSQL מנוהל עם TLS.
2. שמרו את כל הסודות במנהל הסודות של הפלטפורמה; רק Client ID של PayPal ציבורי.
3. הריצו `npm ci`, `npx prisma migrate deploy`, ואז `npm run build`.
4. הפעילו ב־Node.js עם `npm start`; הגדירו HTTPS, כתובת בסיס וקישוריות יוצאת לספקים.
5. בדקו PayPal Sandbox ו־webhooks/פיוס לפני מעבר ל־live.

## מגבלות MVP

- Demo מציג fixture מיידי וחתום, לא orchestration ולא סריקת ספקים. SANDBOX/LIVE מפעילים orchestration רק דרך QStash worker durable.
- rate limiting ב־Demo הוא best-effort מקומי ואינו תחליף להגנת Production; SANDBOX/LIVE מחייבים Upstash Redis משותף.
- אין חשבונות משתמשים; entitlement קשור ל־Audit ולתשלום.
- נגישות אוטומטית אינה תחליף לבדיקה ידנית מלאה.
- מצב Demo אינו persistence אמיתי ואינו בודק APIs חיצוניים; לידים בו אינם נשמרים.

ראו גם [ARCHITECTURE.md](./ARCHITECTURE.md), [SECURITY.md](./SECURITY.md), [AUDIT_SCORING.md](./AUDIT_SCORING.md) ו־[DECISIONS.md](./DECISIONS.md).
