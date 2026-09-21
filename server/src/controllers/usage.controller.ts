import type { RequestHandler } from "express";
import { ApiError } from "../middleware/error.middleware.js";
import { serializeProjectListItem } from "../serializers/project.serializer.js";
import { listProjects } from "../services/project.service.js";
import { getCurrentUsage } from "../services/usage.service.js";

function user(req: Parameters<RequestHandler>[0]) {
  if (!req.authUser) throw new ApiError(401, "Authentication credentials were not provided.");
  return req.authUser;
}

export const usageController: RequestHandler = async (req, res) => {
  const current = user(req);
  res.json(await getCurrentUsage(current.id));
};

export const workspaceController: RequestHandler = async (req, res) => {
  const current = user(req);
  const [projectRows, usage] = await Promise.all([
    listProjects(current.username),
    getCurrentUsage(current.id)
  ]);
  res.json({ projects: projectRows.map(serializeProjectListItem), usage });
};
