import { spawn } from "node:child_process";

const children = new Set();
let stopping = false;

function run(command, args, name) {
  const child = spawn(command, args, { env: process.env, stdio: "inherit" });
  children.add(child);
  child.once("exit", (code, signal) => {
    children.delete(child);
    if (stopping) return;
    console.error(`${name} exited unexpectedly`, { code, signal });
    shutdown(code || 1);
  });
  return child;
}

function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  const timer = setTimeout(() => {
    for (const child of children) child.kill("SIGKILL");
    process.exit(code);
  }, 25_000);
  timer.unref();
  Promise.all([...children].map((child) => new Promise((resolve) => child.once("exit", resolve))))
    .finally(() => process.exit(code));
}

process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));

run("node", ["node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0", "-p", process.env.PORT || "3000"], "web");
run("node", ["node_modules/tsx/dist/cli.mjs", "worker/index.ts"], "mail worker");
