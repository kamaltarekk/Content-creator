import { execSync } from "node:child_process";

/** Re-seed the demo data before the e2e run so the journey is deterministic. */
export default function globalSetup() {
  execSync("pnpm db:seed", { stdio: "inherit" });
}
