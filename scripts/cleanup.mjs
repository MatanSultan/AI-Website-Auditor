import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const prisma = new PrismaClient();
const now = new Date();
try {
  const result = await prisma.$transaction(async (tx) => {
    const [{ locked }] = await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(92837465) AS locked`;
    if (!locked) return { skipped: true, clearedExtractedContent: 0, deletedExpiredUnpaidAudits: 0 };
    const content = await tx.auditPage.updateMany({ where: { contentExpiresAt: { lt: now } }, data: { extractedContent: null, contentExpiresAt: null } });
    const audits = await tx.audit.deleteMany({ where: { expiresAt: { lt: now }, payments: { none: { status: "CAPTURED" } } } });
    return { skipped: false, clearedExtractedContent: content.count, deletedExpiredUnpaidAudits: audits.count };
  });
  console.log(JSON.stringify(result));
} finally {
  await prisma.$disconnect();
}
