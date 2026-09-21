import type { RequestHandler } from "express";

export function migrationPlaceholder(feature: string): RequestHandler {
  return (_req, res) => {
    res.status(501).json({
      detail: `${feature} has not been ported to the Express backend yet.`,
      migration_stage: "foundation"
    });
  };
}
