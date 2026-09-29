// Next.js forwards node flags to workers via NODE_OPTIONS, which rejects
// --use-system-ca, so the OS certificate store is enabled via env instead.
// Usage: node scripts/system-ca.mjs [node flags...] <script> [args...]
import { spawn } from "node:child_process";

const argv = process.argv.slice(2);
const scriptIndex = argv.findIndex((arg) => !arg.startsWith("--"));
if (scriptIndex === -1) {
  console.error("Usage: node scripts/system-ca.mjs [node flags...] <script> [args...]");
  process.exit(1);
}

const env = { ...process.env, NODE_USE_SYSTEM_CA: "1" };
if (env.NODE_OPTIONS?.includes("--use-system-ca")) {
  env.NODE_OPTIONS = env.NODE_OPTIONS.replace(/--use-system-ca/g, "").trim();
}

const child = spawn(process.execPath, argv, { env, stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code, signal) => {
  process.exit(signal ? 1 : (code ?? 1));
});
