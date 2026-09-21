import { Router } from "express";
import { aiRouter } from "./ai.routes.js";
import { healthRouter } from "./health.routes.js";
import { projectsRouter } from "./projects.routes.js";
import { publicRouter } from "./public.routes.js";
import { usageRouter } from "./usage.routes.js";

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(projectsRouter);
apiRouter.use(aiRouter);
apiRouter.use(usageRouter);
apiRouter.use(publicRouter);
