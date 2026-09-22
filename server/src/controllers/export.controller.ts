import type { RequestHandler } from "express";
import { ApiError } from "../middleware/error.middleware.js";
import { projectId } from "../schemas/ai.schemas.js";
import { buildExportFilename, buildExportSections, generateDocx, generatePdf } from "../services/export.service.js";
import { getProject } from "../services/project.service.js";

export const exportProjectController: RequestHandler = async (req, res) => {
  if (!req.authUser) throw new ApiError(401, "Authentication credentials were not provided.");
  const project = await getProject(req.authUser, projectId(req.params.id));
  const format = String(req.query.file_type || req.query.export_format || "").trim().toLowerCase();
  if (format !== "pdf" && format !== "docx") throw new ApiError(400, "file_type must be either 'pdf' or 'docx'.");
  const versionRaw = String(req.query.version_id ?? "").trim();
  const finalRequested = ["1", "true", "yes", "on"].includes(String(req.query.final_version ?? "").trim().toLowerCase());
  let selected = null;
  let sourceLabel = "current";
  if (versionRaw) {
    if (!/^\d+$/.test(versionRaw)) throw new ApiError(400, "version_id must be a numeric value.");
    selected = project.versions.find((version) => version.id === BigInt(versionRaw)) ?? null;
    if (!selected) throw new ApiError(404, "Not found.");
    sourceLabel = selected.label || `v${selected.versionNumber}`;
  } else if (finalRequested) {
    selected = project.versions.find((version) => version.isFinal) ?? null;
    if (!selected) throw new ApiError(404, "Final version not found for this project.");
    sourceLabel = selected.label || "final";
  }
  const source = selected ?? project;
  const metadata = {
    projectName: project.projectName, clientName: project.clientName, projectType: project.projectType,
    budget: project.budget, timeline: project.timeline, sourceLabel
  };
  const sections = buildExportSections(source);
  const bytes = format === "pdf" ? await generatePdf(metadata, sections) : await generateDocx(metadata, sections);
  const contentType = format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${buildExportFilename(project.projectName, sourceLabel, format)}"`);
  res.send(bytes);
};
