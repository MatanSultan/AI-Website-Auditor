import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const prisma = new PrismaClient();
const now = new Date();
try {
  const content = await prisma.auditPage.updateMany({ where: { contentExpiresAt: { lt: now } }, data: { extractedContent: null, contentExpiresAt: null } });
  const audits = await prisma.audit.deleteMany({ where: { expiresAt: { lt: now }, payments: { none: { status: "CAPTURED" } } } });
  console.log(JSON.stringify({ clearedExtractedContent: content.count, deletedExpiredUnpaidAudits: audits.count }));
} finally {
  await prisma.$disconnect();
}
