import type { RequestHandler } from "express";
import { parseInput, publicCommentSchema, publicResponseSchema } from "../schemas/project.schemas.js";
import { serializeComment, serializePublicProject } from "../serializers/project.serializer.js";
import { addPublicComment, respondToPublicProject, viewPublicProject } from "../services/public-proposal.service.js";

function token(req: Parameters<RequestHandler>[0]): string {
  const value = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  return value ?? "";
}

export const publicProposalController: RequestHandler = async (req, res) => {
  res.json(serializePublicProject(await viewPublicProject(token(req))));
};

export const publicResponseController: RequestHandler = async (req, res) => {
  const input = parseInput(publicResponseSchema, req.body);
  res.json(serializePublicProject(await respondToPublicProject(token(req), input)));
};

export const publicCommentController: RequestHandler = async (req, res) => {
  const input = parseInput(publicCommentSchema, req.body);
  res.status(201).json(serializeComment(await addPublicComment(token(req), input)));
};
