import type { RequestHandler } from "express";
import { ApiError } from "../middleware/error.middleware.js";
import {
  createProjectSchema, parseInput, restoreVersionSchema, shareLinkSchema, updateProjectSchema
} from "../schemas/project.schemas.js";
import { serializeProject, serializeProjectListItem } from "../serializers/project.serializer.js";
import * as projects from "../services/project.service.js";

function auth(req: Parameters<RequestHandler>[0]) {
  if (!req.authUser) throw new ApiError(401, "Authentication credentials were not provided.");
  return req.authUser;
}

function projectId(req: Parameters<RequestHandler>[0]): bigint {
  const value = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!value || !/^\d+$/.test(value)) throw new ApiError(404, "Not found.");
  return BigInt(value);
}

export const listProjectController: RequestHandler = async (req, res) => {
  const user = auth(req);
  const rows = await projects.listProjects(user);
  res.json(rows.map(serializeProjectListItem));
};

export const createProjectController: RequestHandler = async (req, res) => {
  const user = auth(req);
  const input = parseInput(createProjectSchema, req.body);
  if (user.isDemo && input.payment_url) {
    throw new ApiError(400, "Invalid request.", { payment_url: "Payment links are disabled in demo mode." });
  }
  const project = await projects.createProject(user, input, user.isDemo);
  res.status(201).json(serializeProject(project));
};

export const getProjectController: RequestHandler = async (req, res) => {
  const user = auth(req);
  res.json(serializeProject(await projects.getProject(user, projectId(req))));
};

export const updateProjectController: RequestHandler = async (req, res) => {
  const user = auth(req);
  const input = parseInput(req.method === "PUT" ? createProjectSchema : updateProjectSchema, req.body);
  if (user.isDemo && input.payment_url) {
    throw new ApiError(400, "Invalid request.", { payment_url: "Payment links are disabled in demo mode." });
  }
  res.json(serializeProject(await projects.updateProject(user, projectId(req), input)));
};

export const deleteProjectController: RequestHandler = async (req, res) => {
  const user = auth(req);
  await projects.deleteProject(user, projectId(req), user.isDemo);
  res.status(204).end();
};

export const restoreVersionController: RequestHandler = async (req, res) => {
  const user = auth(req);
  if (!req.body?.version_id) throw new ApiError(400, "version_id is required.");
  const input = parseInput(restoreVersionSchema, req.body);
  res.json(serializeProject(await projects.restoreVersion(user, projectId(req), input.version_id)));
};

export const markFinalController: RequestHandler = async (req, res) => {
  const user = auth(req);
  const input = parseInput(updateProjectSchema, req.body);
  if (user.isDemo && input.payment_url) {
    throw new ApiError(400, "Invalid request.", { payment_url: "Payment links are disabled in demo mode." });
  }
  res.json(serializeProject(await projects.markFinal(user, projectId(req), input)));
};

export const shareLinkController: RequestHandler = async (req, res) => {
  const user = auth(req);
  const input = parseInput(shareLinkSchema, req.body);
  res.json(serializeProject(await projects.manageShareLink(user, projectId(req), input.operation, user.isDemo)));
};
