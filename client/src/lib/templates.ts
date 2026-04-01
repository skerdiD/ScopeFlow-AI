export const TEMPLATE_SECTION_CONFIG = [
  { key: "summary", label: "Summary" },
  { key: "scope", label: "Scope" },
  { key: "deliverables", label: "Deliverables" },
  { key: "milestones", label: "Milestones" },
  { key: "timeline", label: "Timeline" },
  { key: "assumptions", label: "Assumptions" },
  { key: "risks", label: "Risks" }
] as const;

export type TemplateSectionKey = (typeof TEMPLATE_SECTION_CONFIG)[number]["key"];

export type TemplateSection = {
  included: boolean;
  content: string;
};

export type TemplateSections = Record<TemplateSectionKey, TemplateSection>;

export type ProposalTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  sections: TemplateSections;
};

export type TemplateDraftInput = {
  name: string;
  description: string;
  category: string;
  sections: TemplateSections;
};

export type TemplateIntakePrefill = {
  client_name: string;
  business_type: string;
  project_goals: string;
  required_features: string;
  budget_range: string;
  timeline: string;
  call_notes: string;
};

const TEMPLATE_STORAGE_KEY = "scopeflow.templates.v1";
const DEFAULT_TIMELINE = "2-3 months";

const DEFAULT_SECTION_STATES: TemplateSections = {
  summary: { included: true, content: "" },
  scope: { included: true, content: "" },
  deliverables: { included: true, content: "" },
  milestones: { included: true, content: "" },
  timeline: { included: true, content: "" },
  assumptions: { included: false, content: "" },
  risks: { included: false, content: "" }
};

function nowIsoString() {
  return new Date().toISOString();
}

function cloneSections(sections: TemplateSections): TemplateSections {
  return {
    summary: { ...sections.summary },
    scope: { ...sections.scope },
    deliverables: { ...sections.deliverables },
    milestones: { ...sections.milestones },
    timeline: { ...sections.timeline },
    assumptions: { ...sections.assumptions },
    risks: { ...sections.risks }
  };
}

function cloneTemplate(template: ProposalTemplate): ProposalTemplate {
  return {
    ...template,
    sections: cloneSections(template.sections)
  };
}

function generateTemplateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `tpl_${crypto.randomUUID()}`;
  }
  return `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildSeedTemplate(input: {
  id: string;
  name: string;
  description: string;
  category: string;
  sections: Partial<TemplateSections>;
}): ProposalTemplate {
  const createdAt = nowIsoString();
  return {
    id: input.id,
    name: input.name,
    description: input.description,
    category: input.category,
    createdAt,
    updatedAt: createdAt,
    sections: createDefaultTemplateSections(input.sections)
  };
}

function normalizeSection(rawSection: unknown, fallback: TemplateSection): TemplateSection {
  if (!rawSection || typeof rawSection !== "object") {
    return { ...fallback };
  }

  const sectionValue = rawSection as { included?: unknown; content?: unknown };
  return {
    included:
      typeof sectionValue.included === "boolean"
        ? sectionValue.included
        : fallback.included,
    content:
      typeof sectionValue.content === "string"
        ? sectionValue.content
        : fallback.content
  };
}

function normalizeSections(rawSections: unknown): TemplateSections {
  const sections = rawSections && typeof rawSections === "object"
    ? (rawSections as Record<string, unknown>)
    : {};

  return {
    summary: normalizeSection(sections.summary, DEFAULT_SECTION_STATES.summary),
    scope: normalizeSection(sections.scope, DEFAULT_SECTION_STATES.scope),
    deliverables: normalizeSection(sections.deliverables, DEFAULT_SECTION_STATES.deliverables),
    milestones: normalizeSection(sections.milestones, DEFAULT_SECTION_STATES.milestones),
    timeline: normalizeSection(sections.timeline, DEFAULT_SECTION_STATES.timeline),
    assumptions: normalizeSection(sections.assumptions, DEFAULT_SECTION_STATES.assumptions),
    risks: normalizeSection(sections.risks, DEFAULT_SECTION_STATES.risks)
  };
}

function normalizeTemplate(rawTemplate: unknown, index: number): ProposalTemplate | null {
  if (!rawTemplate || typeof rawTemplate !== "object") {
    return null;
  }

  const template = rawTemplate as Record<string, unknown>;
  const fallbackDate = nowIsoString();

  return {
    id: typeof template.id === "string" && template.id.trim() ? template.id : `tpl_fallback_${index + 1}`,
    name:
      typeof template.name === "string" && template.name.trim()
        ? template.name.trim()
        : `Template ${index + 1}`,
    description: typeof template.description === "string" ? template.description : "",
    category:
      typeof template.category === "string" && template.category.trim()
        ? template.category.trim()
        : "General",
    createdAt:
      typeof template.createdAt === "string" && template.createdAt.trim()
        ? template.createdAt
        : fallbackDate,
    updatedAt:
      typeof template.updatedAt === "string" && template.updatedAt.trim()
        ? template.updatedAt
        : fallbackDate,
    sections: normalizeSections(template.sections)
  };
}

const seededTemplates: ProposalTemplate[] = [
  buildSeedTemplate({
    id: "seed-website-redesign",
    name: "Website Redesign Proposal",
    description: "For redesigning an existing marketing site with improved UX, conversion flow, and content structure.",
    category: "Web Design",
    sections: {
      summary: {
        included: true,
        content:
          "Redesign the current website to improve messaging clarity, trust signals, and conversion performance while preserving brand consistency."
      },
      scope: {
        included: true,
        content:
          "- UX audit of key pages and conversion paths\n- New sitemap and page structure\n- Responsive UI design for core templates\n- CMS-ready front-end implementation"
      },
      deliverables: {
        included: true,
        content:
          "- Discovery and UX findings report\n- Approved desktop and mobile page designs\n- Implemented responsive website templates\n- QA checklist and launch-ready handoff package"
      },
      milestones: {
        included: true,
        content:
          "Discovery and direction approval\nDesign system and page template design\nDevelopment and CMS integration\nQA, revisions, and launch handoff"
      },
      timeline: {
        included: true,
        content: "8-10 weeks"
      },
      assumptions: {
        included: true,
        content: "Client provides final brand assets and revised copy within agreed review windows."
      }
    }
  }),
  buildSeedTemplate({
    id: "seed-saas-mvp",
    name: "SaaS MVP Build",
    description: "For early-stage SaaS products that need a lean MVP with core user workflows and launch readiness.",
    category: "SaaS",
    sections: {
      summary: {
        included: true,
        content:
          "Design and build an MVP focused on core user workflows, secure authentication, and a production-ready release baseline."
      },
      scope: {
        included: true,
        content:
          "- Product discovery and MVP scoping\n- Core workflow implementation\n- Authentication and role-based access\n- Dashboard and reporting basics\n- Deployment and monitoring setup"
      },
      deliverables: {
        included: true,
        content:
          "- Finalized MVP scope document\n- Production-ready web application\n- Admin controls for key workflows\n- Technical documentation and handover notes"
      },
      milestones: {
        included: true,
        content:
          "Scope confirmation and architecture\nCore features and workflow build\nQA and stabilization sprint\nProduction deployment and handoff"
      },
      timeline: {
        included: true,
        content: "10-12 weeks"
      },
      risks: {
        included: true,
        content: "Late scope expansion can impact delivery timeline and release quality."
      }
    }
  }),
  buildSeedTemplate({
    id: "seed-ecommerce-setup",
    name: "E-commerce Store Setup",
    description: "For launching or revamping an online store with catalog, checkout, and operational readiness.",
    category: "E-commerce",
    sections: {
      summary: {
        included: true,
        content:
          "Launch a conversion-focused online store with reliable catalog management, secure checkout, and operational visibility."
      },
      scope: {
        included: true,
        content:
          "- Store architecture and platform setup\n- Product catalog and category structure\n- Checkout and payment configuration\n- Order management and fulfillment workflows"
      },
      deliverables: {
        included: true,
        content:
          "- Configured online store with core pages\n- Product data import and category setup\n- Checkout with payment and shipping logic\n- Launch checklist and post-launch support plan"
      },
      timeline: {
        included: true,
        content: "6-8 weeks"
      },
      assumptions: {
        included: true,
        content: "Product data, SKU details, and policy content are provided by the client."
      }
    }
  }),
  buildSeedTemplate({
    id: "seed-internal-admin-dashboard",
    name: "Internal Admin Dashboard",
    description: "For building operational dashboards for internal teams with role-based access and reporting views.",
    category: "Internal Tools",
    sections: {
      summary: {
        included: true,
        content:
          "Build an internal dashboard that centralizes operational data, improves team visibility, and supports faster decisions."
      },
      scope: {
        included: true,
        content:
          "- Discovery of operational workflows\n- Role-based dashboard screens\n- Data table, filters, and exports\n- Notifications and activity tracking"
      },
      deliverables: {
        included: true,
        content:
          "- Workflow specification and UI wireframes\n- Dashboard interface with key modules\n- QA and role-based access validation\n- Admin guide and onboarding session"
      },
      milestones: {
        included: true,
        content:
          "Requirements and workflow mapping\nDashboard build and data integration\nTesting and user acceptance\nRollout and onboarding"
      },
      risks: {
        included: true,
        content: "Data source inconsistencies may affect timeline unless resolved early."
      }
    }
  })
];

export function createDefaultTemplateSections(overrides?: Partial<TemplateSections>): TemplateSections {
  const baseSections = cloneSections(DEFAULT_SECTION_STATES);

  if (!overrides) {
    return baseSections;
  }

  for (const section of TEMPLATE_SECTION_CONFIG) {
    const key = section.key;
    const overrideValue = overrides[key];
    if (!overrideValue) {
      continue;
    }
    baseSections[key] = {
      included:
        typeof overrideValue.included === "boolean"
          ? overrideValue.included
          : baseSections[key].included,
      content:
        typeof overrideValue.content === "string"
          ? overrideValue.content
          : baseSections[key].content
    };
  }

  return baseSections;
}

export function getTemplateSectionLabel(key: TemplateSectionKey) {
  const section = TEMPLATE_SECTION_CONFIG.find((item) => item.key === key);
  return section ? section.label : key;
}

export function getIncludedTemplateSections(template: ProposalTemplate): TemplateSectionKey[] {
  return TEMPLATE_SECTION_CONFIG
    .map((section) => section.key)
    .filter((sectionKey) => template.sections[sectionKey].included);
}

export function getSeedTemplates(): ProposalTemplate[] {
  return seededTemplates.map(cloneTemplate);
}

export function loadTemplatesFromStorage(): ProposalTemplate[] {
  if (typeof window === "undefined") {
    return getSeedTemplates();
  }

  const rawValue = window.localStorage.getItem(TEMPLATE_STORAGE_KEY);
  if (!rawValue) {
    const seeded = getSeedTemplates();
    persistTemplatesToStorage(seeded);
    return seeded;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      const seeded = getSeedTemplates();
      persistTemplatesToStorage(seeded);
      return seeded;
    }

    const normalizedTemplates = parsed
      .map((template, index) => normalizeTemplate(template, index))
      .filter((template): template is ProposalTemplate => Boolean(template));

    if (normalizedTemplates.length === 0) {
      const seeded = getSeedTemplates();
      persistTemplatesToStorage(seeded);
      return seeded;
    }

    persistTemplatesToStorage(normalizedTemplates);
    return normalizedTemplates.map(cloneTemplate);
  } catch {
    const seeded = getSeedTemplates();
    persistTemplatesToStorage(seeded);
    return seeded;
  }
}

export function persistTemplatesToStorage(templates: ProposalTemplate[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
}

export function createTemplateFromDraft(draft: TemplateDraftInput): ProposalTemplate {
  const now = nowIsoString();
  return {
    id: generateTemplateId(),
    name: draft.name.trim(),
    description: draft.description.trim(),
    category: draft.category.trim(),
    createdAt: now,
    updatedAt: now,
    sections: createDefaultTemplateSections(draft.sections)
  };
}

export function updateTemplateFromDraft(template: ProposalTemplate, draft: TemplateDraftInput): ProposalTemplate {
  return {
    ...template,
    name: draft.name.trim(),
    description: draft.description.trim(),
    category: draft.category.trim(),
    updatedAt: nowIsoString(),
    sections: createDefaultTemplateSections(draft.sections)
  };
}

export function duplicateTemplate(template: ProposalTemplate): ProposalTemplate {
  const now = nowIsoString();
  const sourceName = template.name.trim();
  const duplicateName = sourceName.toLowerCase().endsWith(" copy")
    ? `${sourceName} 2`
    : `${sourceName} Copy`;

  return {
    ...template,
    id: generateTemplateId(),
    name: duplicateName,
    createdAt: now,
    updatedAt: now,
    sections: createDefaultTemplateSections(template.sections)
  };
}

export function getTemplateById(templateId: string): ProposalTemplate | null {
  if (!templateId) {
    return null;
  }

  const templates = loadTemplatesFromStorage();
  return templates.find((template) => template.id === templateId) ?? null;
}

function normalizeTimelinePrefill(value: string) {
  const text = value.trim().toLowerCase();
  if (!text) {
    return DEFAULT_TIMELINE;
  }

  if (text.includes("2-3 week") || text.includes("2 to 3 week") || text.includes("3 week")) {
    return "2-3 weeks";
  }

  if (text.includes("1 month") || text.includes("4 week")) {
    return "1 month";
  }

  if (
    text.includes("4-6 month") ||
    text.includes("4 to 6 month") ||
    text.includes("5 month") ||
    text.includes("6 month")
  ) {
    return "4-6 months";
  }

  return DEFAULT_TIMELINE;
}

function getSectionText(template: ProposalTemplate, key: TemplateSectionKey) {
  const section = template.sections[key];
  if (!section.included) {
    return "";
  }
  return section.content.trim();
}

export function mapTemplateToIntakePrefill(template: ProposalTemplate): Partial<TemplateIntakePrefill> {
  const summary = getSectionText(template, "summary");
  const scope = getSectionText(template, "scope");
  const deliverables = getSectionText(template, "deliverables");
  const milestones = getSectionText(template, "milestones");
  const timeline = getSectionText(template, "timeline");
  const assumptions = getSectionText(template, "assumptions");
  const risks = getSectionText(template, "risks");

  const featureSegments = [
    scope ? `Scope priorities:\n${scope}` : "",
    deliverables ? `Expected deliverables:\n${deliverables}` : ""
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  const callNotesSegments = [
    milestones ? `Milestone guidance:\n${milestones}` : "",
    assumptions ? `Assumptions:\n${assumptions}` : "",
    risks ? `Risks:\n${risks}` : ""
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  return {
    business_type: template.category,
    project_goals: summary || template.description,
    required_features: featureSegments || template.description,
    timeline: normalizeTimelinePrefill(timeline),
    call_notes: callNotesSegments
  };
}
