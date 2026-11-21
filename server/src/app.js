import express from "express";
import helmet from "helmet";
import cors from "cors";
import { errorHandler } from "./http/errors.js";
import { createAuthRouter } from "./routes/auth.routes.js";
import healthRoutes from "./routes/health.routes.js";
import { createMovementsRouter } from "./routes/movements.routes.js";
import { createProductsRouter } from "./routes/products.routes.js";
import { createUsersRouter } from "./routes/users.routes.js";

export function createApp(env) {
  const app = express();
  app.disable("x-powered-by");
  app.locals.environment = env.nodeEnv;

  app.use(helmet());
  app.use(cors({
    origin(requestOrigin, callback) {
      if (requestOrigin && requestOrigin === env.clientOrigin) {
        callback(null, requestOrigin);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  }));
  app.use(express.json());
  app.use("/api/health", healthRoutes);
  app.use("/api/auth", createAuthRouter(env));
  app.use("/api/products", createProductsRouter(env));
  app.use("/api/movements", createMovementsRouter(env));
  app.use("/api/users", createUsersRouter(env));

  app.use((req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use(errorHandler);

  return app;
}
