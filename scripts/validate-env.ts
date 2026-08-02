import { validateEnvironment } from "../lib/env";

try {
  const environment = validateEnvironment(process.env);
  console.log(`Environment configuration valid (${environment.appMode})`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Invalid environment configuration");
  process.exit(1);
}
