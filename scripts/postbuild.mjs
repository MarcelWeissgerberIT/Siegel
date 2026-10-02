// After `next build` (server target), make .next/standalone runnable on its own:
// Next leaves public/ and .next/static/ out of the standalone folder.
import fs from "node:fs";

if (process.env.SIEGEL_STATIC !== "1" && fs.existsSync(".next/standalone")) {
  fs.cpSync("public", ".next/standalone/public", { recursive: true });
  fs.cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
  console.log("✓ Copied public/ and .next/static into .next/standalone");
}
