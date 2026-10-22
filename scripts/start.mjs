import { spawn, spawnSync } from "node:child_process";

if (!process.env.MIGRATE_DATABASE_URL && process.env.DATABASE_URL) {
  process.env.MIGRATE_DATABASE_URL = process.env.DATABASE_URL;
}

const migrate = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "apps/api/prisma/schema.prisma"],
  { stdio: "inherit", env: process.env },
);
if (migrate.status !== 0) process.exit(migrate.status ?? 1);

const apiPort = process.env.API_PORT || "3001";
const webPort = process.env.PORT || "3000";
const apiProxy = process.env.API_PROXY_URL || `http://127.0.0.1:${apiPort}`;
const apiEnv = { ...process.env, API_PORT: apiPort, PORT: apiPort, API_PROXY_URL: apiProxy };
const webEnv = { ...process.env, API_PORT: apiPort, PORT: webPort, API_PROXY_URL: apiProxy };

const shell = process.platform === "win32";
const api = spawn(process.execPath, ["apps/api/dist/main.js"], { stdio: "inherit", env: apiEnv });
const web = spawn("npm", ["run", "start", "--workspace", "@vmp/web", "--", "--hostname", "0.0.0.0", "--port", webPort], {
  stdio: "inherit",
  env: webEnv,
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
