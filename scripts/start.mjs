import { spawn, spawnSync } from "node:child_process";

const migrate = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "apps/api/prisma/schema.prisma"],
  { stdio: "inherit", env: process.env },
);
if (migrate.status !== 0) process.exit(migrate.status ?? 1);

const apiPort = process.env.API_PORT || "3001";
const webPort = process.env.PORT || "3000";
const env = {
  ...process.env,
  API_PORT: apiPort,
  PORT: webPort,
  API_PROXY_URL: process.env.API_PROXY_URL || `http://127.0.0.1:${apiPort}`,
};

const shell = process.platform === "win32";
const api = spawn(process.execPath, ["apps/api/dist/main.js"], { stdio: "inherit", env });
const web = spawn("npm", ["run", "start", "--workspace", "@vmp/web", "--", "--port", webPort], {
  stdio: "inherit",
  env,
  shell,
});

let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  api.kill("SIGTERM");
  web.kill("SIGTERM");
  setTimeout(() => process.exit(code), 500).unref();
}

api.on("exit", (code) => stop(code ?? 1));
web.on("exit", (code) => stop(code ?? 1));
process.on("SIGTERM", () => stop(0));
process.on("SIGINT", () => stop(0));
