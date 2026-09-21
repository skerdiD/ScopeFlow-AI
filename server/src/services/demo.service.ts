import type { Prisma, PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

const DEMO_PROJECT_COUNT = 10;
const verifiedUntil = new Map<number, number>();

type DemoProject = {
  projectName: string; clientName: string; projectType: string; budget: string; timeline: string;
  status: "draft" | "sent" | "approved"; summary: string; scope: string[]; deliverables: string[];
  milestones: string[]; pricing: string[]; risks: string[]; nextSteps: string[]; versions: number; final?: boolean;
  daysCreated: number; daysUpdated: number;
};

export const DEMO_PROJECTS: DemoProject[] = [
  ["SaaS Landing Page Proposal", "Northstar Labs", "Landing Page", "$8,000 - $12,000", "3-4 weeks", "approved", "A conversion-focused SaaS landing page designed to explain the product clearly and move qualified visitors toward demo booking."],
  ["AI Chatbot Integration", "BrightDesk Support", "AI Automation", "$18,000 - $28,000", "6-8 weeks", "sent", "An AI-assisted support workflow that improves response speed while retaining human review for complex customer issues."],
  ["E-commerce Redesign", "Maven & Co.", "E-commerce", "$22,000 - $35,000", "8-10 weeks", "approved", "A storefront redesign focused on product discovery, conversion flow, and a reliable checkout experience."],
  ["Real Estate CRM Dashboard", "Harbor Realty Group", "Dashboard", "$30,000 - $45,000", "10-12 weeks", "sent", "A role-based CRM dashboard that centralizes leads, property activity, and follow-up workflows."],
  ["Restaurant Booking Platform", "Casa Verde Kitchen", "Booking Platform", "$16,000 - $24,000", "6-7 weeks", "draft", "A customer booking platform with availability management, confirmations, and operational visibility."],
  ["Startup MVP Build", "OrbitTask", "SaaS MVP", "$40,000 - $65,000", "12-14 weeks", "sent", "A focused SaaS MVP that validates core workflows and supports a controlled pilot launch."],
  ["Automation Workflow Setup", "LedgerSpring Finance", "Workflow Automation", "$9,000 - $15,000", "4-5 weeks", "approved", "A workflow automation setup that reduces manual handoffs across intake, review, and client follow-up."],
  ["Fitness Coaching Website", "Elevate Performance", "Website", "$7,500 - $11,000", "4 weeks", "draft", "A modern coaching website that presents packages, client outcomes, and clear inquiry paths."],
  ["Analytics Dashboard Build", "PulseMetrics", "Analytics Dashboard", "$28,000 - $42,000", "8-9 weeks", "sent", "An analytics dashboard that gives leadership a clear view of adoption, revenue signals, and operational trends."],
  ["Agency Retainer Proposal", "BluePeak Studio", "Retainer", "$6,000/month", "Monthly retainer", "approved", "A monthly agency retainer covering campaign support, analytics review, and fast-turnaround improvements."]
].map((row, index) => ({
  projectName: row[0], clientName: row[1], projectType: row[2], budget: row[3], timeline: row[4], status: row[5], summary: row[6],
  scope: ["Discovery and requirements alignment", `Design and implement the core ${String(row[2]).toLowerCase()} workflow`, "Review progress with stakeholders", "Complete QA and launch preparation"],
  deliverables: ["Scope and execution plan", "Approved experience design", "Production-ready implementation", "QA and acceptance checklist", "Handover documentation"],
  milestones: ["Discovery: Confirm goals and scope.", "Design: Approve direction and workflows.", "Build: Implement and review core functionality.", "Launch: Complete QA and handover."],
  pricing: [`Project budget: ${row[3]}`, "Payment schedule confirmed at kickoff"],
  risks: ["Late feedback may affect milestone timing.", "Scope changes may require timeline or budget adjustments."],
  nextSteps: ["Approve proposal", "Confirm project owner", "Schedule kickoff"],
  versions: [3, 2, 3, 2, 1, 3, 3, 1, 2, 3][index],
  final: [0, 2, 6, 9].includes(index),
  daysCreated: [29, 24, 21, 18, 16, 15, 13, 10, 7, 5][index],
  daysUpdated: [3, 2, 4, 6, 9, 2, 5, 8, 1, 0][index]
})) as DemoProject[];

function currentPeriod() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function bullets(items: string[]) { return items.map((item) => `- ${item}`).join("\n"); }
function generated(project: DemoProject): Prisma.InputJsonValue {
  return {
    summary: project.summary, scope_of_work: project.scope, deliverables: project.deliverables,
    milestones: project.milestones.map((item) => {
      const [title, ...description] = item.split(":");
      return { title: title.trim(), description: description.join(":").trim() || item };
    }),
    timeline: [project.timeline], pricing: project.pricing, risks: project.risks, next_steps: project.nextSteps
  };
}

async function localDemoUser(email: string) {
  const found = await prisma.djangoUser.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, orderBy: { id: "asc" } });
  if (found) return found;
  const slug = email.split("@", 1)[0].replace(/[._]/g, "-");
  const username = `demo-seed-${slug}`.slice(0, 150);
  const existingUsername = await prisma.djangoUser.findUnique({ where: { username } });
  if (existingUsername) {
    return prisma.djangoUser.update({
      where: { id: existingUsername.id },
      data: { email, firstName: existingUsername.firstName || "Alex", lastName: existingUsername.lastName || "Morgan" }
    });
  }
  return prisma.djangoUser.create({
    data: {
      username, email, firstName: "Alex", lastName: "Morgan",
      password: "!", isStaff: false, isActive: true, isSuperuser: false, dateJoined: new Date()
    }
  });
}

export async function seedDemoWorkspace(options: { email?: string; reset?: boolean } = {}) {
  const email = (options.email ?? env.DEMO_ACCOUNT_EMAIL).trim().toLowerCase();
  const user = await localDemoUser(email);
  return prisma.$transaction(async (tx) => {
    if (options.reset) {
      const ids = (await tx.proposalProject.findMany({ where: { userId: user.username, isDemo: true }, select: { id: true } })).map((item) => item.id);
      if (ids.length) {
        await tx.aIUsageLog.deleteMany({ where: { userId: user.id, projectId: { in: ids } } });
        await tx.aIQualityReview.deleteMany({ where: { userId: user.id, projectId: { in: ids } } });
        await tx.proposalProject.deleteMany({ where: { id: { in: ids }, userId: user.username, isDemo: true } });
      }
      if (user.username.startsWith("demo-seed-")) {
        await tx.usageRecord.deleteMany({ where: { userId: user.id, period: currentPeriod() } });
        await tx.userPlan.deleteMany({ where: { userId: user.id } });
      }
    }
    await tx.userPlan.upsert({ where: { userId: user.id }, create: { userId: user.id, plan: "pro" }, update: { plan: "pro" } });
    await tx.usageRecord.upsert({
      where: { userId_period: { userId: user.id, period: currentPeriod() } },
      create: { userId: user.id, period: currentPeriod(), aiGenerationsUsed: 50 },
      update: { aiGenerationsUsed: 50 }
    });
    const projects = [];
    for (let index = 0; index < DEMO_PROJECTS.length; index += 1) {
      const data = DEMO_PROJECTS[index];
      const existing = await tx.proposalProject.findFirst({ where: { userId: user.username, projectName: data.projectName } });
      const fields = {
        clientName: data.clientName, projectType: data.projectType, budget: data.budget, timeline: data.timeline,
        requirements: `Client goal: ${data.summary}\nBudget: ${data.budget}\nTimeline: ${data.timeline}`,
        summary: data.summary, scope: bullets(data.scope), deliverables: bullets(data.deliverables),
        milestones: data.milestones.join("\n"), proposalTimeline: bullets([data.timeline]), pricing: bullets(data.pricing),
        risks: bullets(data.risks), nextSteps: bullets(data.nextSteps),
        missingInformation: data.status === "draft" ? ["Final stakeholder approver", "Confirmed launch window"] : [],
        scopeRisks: data.risks.slice(0, 2), unclearRequirements: data.status === "approved" ? [] : ["Exact third-party tool access"],
        suggestedQuestions: ["Who will approve final scope?", "Which workflows are highest priority for launch?", "Are there fixed dates we need to protect?"],
        generatedProposal: generated(data), status: data.status, isDemo: true, shareEnabled: false, shareToken: null,
        createdAt: new Date(Date.now() - data.daysCreated * 86_400_000),
        updatedAt: new Date(Date.now() - data.daysUpdated * 86_400_000)
      };
      const project = existing
        ? await tx.proposalProject.update({ where: { id: existing.id }, data: fields })
        : await tx.proposalProject.create({ data: { userId: user.username, projectName: data.projectName, ...fields } });
      await tx.proposalVersion.deleteMany({ where: { projectId: project.id } });
      let currentVersionId: bigint | null = null;
      for (let versionNumber = 1; versionNumber <= data.versions; versionNumber += 1) {
        const isFinal = Boolean(data.final && versionNumber === data.versions);
        const version = await tx.proposalVersion.create({
          data: {
            projectId: project.id, versionNumber,
            label: ["Initial Draft", "Scope Improved", "Final Client Version"][versionNumber - 1],
            source: isFinal ? "final" : versionNumber > 1 ? "regenerate" : "generate",
            changedSections: versionNumber === 1 ? ["summary", "scope", "deliverables", "milestones", "risks"] : ["scope", "pricing", "next_steps"],
            summary: versionNumber === 1 ? `${data.summary} This first draft establishes the core client direction.` : data.summary,
            scope: bullets(data.scope), deliverables: bullets(data.deliverables), milestones: data.milestones.join("\n"),
            proposalTimeline: bullets([data.timeline]), pricing: bullets(data.pricing), risks: bullets(data.risks), nextSteps: bullets(data.nextSteps), isFinal
          }
        });
        currentVersionId = version.id;
      }
      await tx.proposalProject.update({ where: { id: project.id }, data: { currentVersionId } });
      projects.push(project);
    }
    await tx.aIUsageLog.deleteMany({ where: { userId: user.id, projectId: { in: projects.map((project) => project.id) } } });
    await tx.aIQualityReview.deleteMany({ where: { userId: user.id, projectId: { in: projects.map((project) => project.id) } } });
    const actions = ["full_proposal_generation", "section_regeneration", "quality_score", "edit_suggestions"];
    for (let index = 0; index < 8; index += 1) {
      await tx.aIUsageLog.create({
        data: { userId: user.id, projectId: projects[index].id, actionType: actions[index % actions.length], status: "success", inputTokens: 950 + index * 80, outputTokens: 520 + index * 45, totalTokens: 1470 + index * 125, createdAt: new Date(Date.now() - index * 86_400_000 - index * 7_200_000) }
      });
    }
    for (const [index, project] of projects.filter((item) => ["sent", "approved"].includes(item.status)).slice(0, 4).entries()) {
      const current = await tx.proposalProject.findUniqueOrThrow({ where: { id: project.id }, select: { currentVersionId: true } });
      await tx.aIQualityReview.create({
        data: {
          projectId: project.id, userId: user.id, proposalVersionId: current.currentVersionId,
          score: [88, 91, 84, 89][index], summary: "The proposal is client-ready with a clear scope, practical delivery structure, and strong commercial framing.",
          strengths: ["Clear project scope", "Professional client-facing tone", "Strong timeline and milestone structure"],
          weaknesses: ["Pricing could be easier to scan", "Deliverables could include more measurable outcomes"],
          recommendations: ["Add success metrics", "Clarify revision limits", "Make pricing assumptions more explicit"],
          createdAt: new Date(Date.now() - (index + 1) * 86_400_000 - 10_800_000)
        }
      });
    }
    verifiedUntil.set(user.id, Date.now() + 300_000);
    return { user, projects: projects.length };
  });
}

export async function ensureDemoWorkspace(user: { id: number; username: string; email: string }) {
  if (user.email.trim().toLowerCase() !== env.DEMO_ACCOUNT_EMAIL && !user.username.startsWith("demo-seed-")) return;
  if ((verifiedUntil.get(user.id) ?? 0) > Date.now()) return;
  const [count, plan, usage] = await Promise.all([
    prisma.proposalProject.count({ where: { userId: user.username, isDemo: true } }),
    prisma.userPlan.findUnique({ where: { userId: user.id } }),
    prisma.usageRecord.findUnique({ where: { userId_period: { userId: user.id, period: currentPeriod() } } })
  ]);
  if (count >= DEMO_PROJECT_COUNT && plan?.plan === "pro" && usage) {
    verifiedUntil.set(user.id, Date.now() + 300_000);
    return;
  }
  await seedDemoWorkspace({ email: user.email });
}
