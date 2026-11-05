import { execFileSync } from "node:child_process";

const files = process.argv.slice(2);
const composeFiles = files.length > 0 ? files : ["docker-compose.yml", "deploy/docker-compose.demo.yml"];
const dotnetServices = ["identity-service", "group-service", "recommendation-service", "realtime-service", "gateway"];
const databaseServices = ["identity-service", "group-service", "realtime-service"];
const memoryLimitBytes = 4 * 1024 ** 3;

const rendered = execFileSync(
  "docker",
  ["compose", ...composeFiles.flatMap((file) => ["-f", file]), "--env-file", ".env.example", "config", "--format", "json"],
  { encoding: "utf8", env: { ...process.env, IMAGE_TAG: "check" }, stdio: ["ignore", "pipe", "inherit"] },
);
const config = JSON.parse(rendered);
const services = config.services;
const problems = [];

if (config.name !== "exe-group-demo") {
  problems.push(`project name must be exe-group-demo, got ${config.name}`);
}

for (const [name, service] of Object.entries(services)) {
  if ((service.ports ?? []).length > 0) {
    problems.push(`${name} must not publish host ports`);
  }

  if (!service.image?.includes(":")) {
    problems.push(`${name} must run a tagged image`);
  }

  if (service.restart !== "unless-stopped") {
    problems.push(`${name} must restart unless stopped`);
  }

  if (!service.mem_limit || Number(service.mem_limit) > memoryLimitBytes) {
    problems.push(`${name} must have a memory limit of at most 4 GiB`);
  }

  if ((service.volumes ?? []).some((volume) => volume.type === "bind")) {
    problems.push(`${name} must not bind mount: the demo keeps no project files on the shared host`);
  }
}

for (const name of dotnetServices) {
  if (services[name]?.environment?.ASPNETCORE_ENVIRONMENT !== "Production") {
    problems.push(`${name} must run in Production`);
  }
}

for (const name of databaseServices) {
  if (services[name]?.environment?.Database__MigrateOnStartup !== "true") {
    problems.push(`${name} must migrate on startup`);
  }
}

if (!services.sqlserver?.environment?.MSSQL_MEMORY_LIMIT_MB) {
  problems.push("sqlserver must set MSSQL_MEMORY_LIMIT_MB on a shared server");
}

const edgeKey = Object.entries(config.networks ?? {}).find(([, network]) => network.name === "nginx-network" && network.external)?.[0];
if (!edgeKey) {
  problems.push("the external nginx-network must be declared");
} else if (!services.web?.networks?.[edgeKey]?.aliases?.includes("exe-group-web")) {
  problems.push("web must join nginx-network with the alias exe-group-web");
}

for (const [name, service] of Object.entries(services)) {
  if (name !== "web" && edgeKey && service.networks?.[edgeKey]) {
    problems.push(`${name} must stay off the shared network`);
  }
}

if (!(services.web?.configs ?? []).some((entry) => entry.target === "/etc/nginx/conf.d/00-real-ip.conf")) {
  problems.push("web must trust the proxy in front of it for the client address");
}

if (!config.configs?.["web-real-ip"]?.content?.includes("104.16.0.0/13")) {
  problems.push("web must trust Cloudflare so the client address survives the proxy");
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}

console.log(`demo compose is valid: ${Object.keys(services).length} services, no host ports`);
