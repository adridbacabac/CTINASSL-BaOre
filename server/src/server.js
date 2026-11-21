import { loadEnv } from "./config/env.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { createApp } from "./app.js";

const env = loadEnv();
const app = createApp(env);

let httpServer;
let shuttingDown = false;

function closeHttpServer() {
  if (!httpServer) return Promise.resolve();
  return new Promise((resolve, reject) => {
    httpServer.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Shutting down (${signal})`);
  try {
    await closeHttpServer();
    await disconnectDatabase();
    console.log("Shutdown complete");
    process.exit(0);
  } catch (error) {
    console.error(`Shutdown failed: ${error.message}`);
    process.exit(1);
  }
}

process.once("SIGINT", () => {
  shutdown("SIGINT");
});

process.once("SIGTERM", () => {
  shutdown("SIGTERM");
});

try {
  await connectDatabase(env.mongodbUri);
  httpServer = app.listen(env.port, "127.0.0.1");
  await new Promise((resolve, reject) => {
    httpServer.once("listening", resolve);
    httpServer.once("error", reject);
  });
  console.log(`API listening on http://127.0.0.1:${env.port}`);
} catch (error) {
  console.error(error.message);
  try {
    await disconnectDatabase();
  } catch (disconnectError) {
    console.error(`MongoDB disconnect failed: ${disconnectError.message}`);
  }
  process.exit(1);
}
