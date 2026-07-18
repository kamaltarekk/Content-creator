import { config } from "dotenv";

// Integration tests talk to the real dev Postgres; load DATABASE_URL etc.
config({ path: ".env" });
