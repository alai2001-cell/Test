import "./_env";
import { closeDb } from "../lib/db";
import { migrate } from "../lib/db";

await migrate();
console.log("✓ database schema is up to date");

await closeDb();
