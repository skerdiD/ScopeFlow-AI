import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const notFoundMiddleware: RequestHandler = (_req, res) => {
  res.status(404).json({ detail: "Not found." });
};

export const errorMiddleware: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ApiError) {
    res.status(error.status).json(error.data ?? { detail: error.message });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json(error.flatten().fieldErrors);
    return;
  }

  if (error instanceof SyntaxError && "status" in error && error.status === 400) {
    res.status(400).json({ detail: "Malformed JSON request body." });
    return;
  }

  if (error && typeof error === "object" && "type" in error && error.type === "entity.too.large") {
    res.status(413).json({ detail: "Request body is too large." });
    return;
  }

  console.error(error);
  res.status(500).json({ detail: "Server error. Please try again later." });
};
