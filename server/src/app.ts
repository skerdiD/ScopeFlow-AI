import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorMiddleware, notFoundMiddleware } from "./middleware/error.middleware.js";
import { apiRouter } from "./routes/index.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.CORS_ALLOWED_ORIGINS.includes(origin.replace(/\/+$/, ""))) {
          callback(null, true);
          return;
        }
        callback(new Error("Not allowed by CORS."));
      },
      credentials: false
    })
  );
  app.use(express.json({ limit: env.JSON_BODY_LIMIT }));
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

  app.use(env.API_PREFIX, apiRouter);
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
