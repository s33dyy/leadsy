import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = process.env.PORT || "3000";

let shutdownSignal = null;

const next = spawn("./node_modules/.bin/next", ["start", "-H", hostname, "-p", port], {
  cwd: appRoot,
  env: process.env,
  stdio: "inherit"
});

function shutdown(signal) {
  shutdownSignal = signal;
  if (!next.killed) {
    next.kill(signal);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

next.on("exit", (code, signal) => {
  if (shutdownSignal || signal === "SIGTERM" || signal === "SIGINT") {
    process.exit(0);
  }
  process.exit(code ?? 1);
});

next.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
