import { createServer } from "node:http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { disconnectPrisma } from "./lib/prisma.js";

const app = createApp();
const server = createServer(app);

server.listen(env.PORT, "127.0.0.1", () => {
  console.log(`ScopeFlow AI API listening on http://127.0.0.1:${env.PORT}${env.API_PREFIX}`);
});

async function shutdown(signal: NodeJS.Signals) {
  console.log(`Received ${signal}; shutting down.`);
  server.close(async () => {
    await disconnectPrisma();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
