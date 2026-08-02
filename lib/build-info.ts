export const APP_VERSION = "0.2.0";
export function buildInfo() { return { version: APP_VERSION, commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? "local" }; }
