export type ActivityType =
  | "project_created"
  | "project_updated"
  | "proposal_generated"
  | "section_regenerated"
  | "version_saved"
  | "final_marked"
  | "template_used"
  | "template_created"
  | "pdf_exported"
  | "status_changed";

export type ActivityActor = "user" | "system" | "ai";

export type ActivityMetadata = Record<string, string | number | boolean | null>;

export type ActivityEvent = {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  projectId: string | null;
  projectName: string;
  actor: ActivityActor;
  createdAt: string;
  metadata: ActivityMetadata;
};

export type ActivityLogInput = {
  type: ActivityType;
  title: string;
  description?: string;
  projectId?: string | number | null;
  projectName?: string;
  actor: ActivityActor;
  createdAt?: string;
  metadata?: ActivityMetadata;
};

export type ActivityFilterType = "all" | ActivityType;
export type ActivityFilterActor = "all" | ActivityActor;

export type ActivityGroup = {
  label: "Today" | "Yesterday" | "This Week" | "Older";
  events: ActivityEvent[];
};

export const ACTIVITY_STORAGE_KEY = "scopeflow.activity.v1";

export const ACTIVITY_TYPE_OPTIONS: { value: ActivityFilterType; label: string }[] = [
  { value: "all", label: "All activity types" },
  { value: "project_created", label: "Project created" },
  { value: "project_updated", label: "Project updated" },
  { value: "proposal_generated", label: "Proposal generated" },
  { value: "section_regenerated", label: "Section regenerated" },
  { value: "version_saved", label: "Version saved" },
  { value: "final_marked", label: "Final marked" },
  { value: "template_used", label: "Template used" },
  { value: "template_created", label: "Template created" },
  { value: "pdf_exported", label: "PDF exported" },
  { value: "status_changed", label: "Status changed" }
];

export const ACTIVITY_ACTOR_OPTIONS: { value: ActivityFilterActor; label: string }[] = [
  { value: "all", label: "All actors" },
  { value: "user", label: "User" },
  { value: "system", label: "System" },
  { value: "ai", label: "AI" }
];

const MAX_STORED_EVENTS = 500;

function createEventId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `act_${crypto.randomUUID()}`;
  }
  return `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function createTimestampHoursAgo(hoursAgo: number) {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
}

function createSeedEvents(): ActivityEvent[] {
  return [
    {
      id: "seed_proposal_generated_acme",
      type: "proposal_generated",
      title: "Proposal generated with AI",
      description: "Initial proposal draft created for Acme Website Redesign.",
      projectId: "seed-acme-redesign",
      projectName: "Acme Website Redesign",
      actor: "ai",
      createdAt: createTimestampHoursAgo(2),
      metadata: { source: "gemini", sectionCount: 4 }
    },
    {
      id: "seed_final_marked_crm",
      type: "final_marked",
      title: "Final version marked",
      description: "Internal CRM proposal moved to final status and locked for delivery.",
      projectId: "seed-internal-crm",
      projectName: "Internal CRM Rollout",
      actor: "user",
      createdAt: createTimestampHoursAgo(7),
      metadata: { status: "completed" }
    },
    {
      id: "seed_template_used_saas",
      type: "template_used",
      title: "Template used for new project",
      description: "SaaS MVP Build template applied to bootstrap proposal input.",
      projectId: null,
      projectName: "SaaS MVP Build",
      actor: "user",
      createdAt: createTimestampHoursAgo(18),
      metadata: { templateName: "SaaS MVP Build" }
    },
    {
      id: "seed_project_updated_ecommerce",
      type: "project_updated",
      title: "Project details updated",
      description: "Scope and timeline revised after client discovery call.",
      projectId: "seed-ecommerce-scope",
      projectName: "E-commerce Scope",
      actor: "user",
      createdAt: createTimestampHoursAgo(33),
      metadata: { changedFields: 3 }
    },
    {
      id: "seed_pdf_exported_client",
      type: "pdf_exported",
      title: "Proposal PDF exported",
      description: "Client Proposal PDF downloaded for stakeholder review.",
      projectId: "seed-client-proposal",
      projectName: "Client Proposal",
      actor: "system",
      createdAt: createTimestampHoursAgo(60),
      metadata: { format: "pdf" }
    },
    {
      id: "seed_template_created_web",
      type: "template_created",
      title: "Template created",
      description: "Website Redesign Proposal template added to the library.",
      projectId: null,
      projectName: "Website Redesign Proposal",
      actor: "user",
      createdAt: createTimestampHoursAgo(84),
      metadata: { category: "Web Design" }
    },
    {
      id: "seed_status_changed",
      type: "status_changed",
      title: "Project status changed",
      description: "Internal Admin Dashboard moved from draft to in review.",
      projectId: "seed-admin-dashboard",
      projectName: "Internal Admin Dashboard",
      actor: "system",
      createdAt: createTimestampHoursAgo(160),
      metadata: { from: "draft", to: "in_review" }
    }
  ];
}

function isActivityType(value: unknown): value is ActivityType {
  return ACTIVITY_TYPE_OPTIONS.some((item) => item.value === value);
}

function isActivityActor(value: unknown): value is ActivityActor {
  return value === "user" || value === "system" || value === "ai";
}

function normalizeActivityEvent(rawEvent: unknown, index: number): ActivityEvent | null {
  if (!rawEvent || typeof rawEvent !== "object") {
    return null;
  }

  const event = rawEvent as Record<string, unknown>;
  const type = event.type;
  const actor = event.actor;

  if (!isActivityType(type) || !isActivityActor(actor)) {
    return null;
  }

  const title = typeof event.title === "string" ? event.title.trim() : "";
  if (!title) {
    return null;
  }

  const createdAtValue = typeof event.createdAt === "string" ? event.createdAt : "";
  const createdAt = createdAtValue || new Date().toISOString();

  let metadata: ActivityMetadata = {};
  if (event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)) {
    metadata = Object.fromEntries(
      Object.entries(event.metadata as Record<string, unknown>).map(([key, value]) => {
        if (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean" ||
          value === null
        ) {
          return [key, value];
        }
        return [key, String(value)];
      })
    );
  }

  return {
    id: typeof event.id === "string" && event.id.trim() ? event.id : `act_fallback_${index + 1}`,
    type,
    title,
    description: typeof event.description === "string" ? event.description : "",
    projectId:
      typeof event.projectId === "string"
        ? event.projectId
        : typeof event.projectId === "number"
          ? String(event.projectId)
          : null,
    projectName: typeof event.projectName === "string" ? event.projectName : "",
    actor,
    createdAt,
    metadata
  };
}

function sortEventsDescending(events: ActivityEvent[]) {
  return [...events].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function readActivityEventsFromStorage(): ActivityEvent[] {
  if (typeof window === "undefined") {
    return sortEventsDescending(createSeedEvents());
  }

  const rawValue = window.localStorage.getItem(ACTIVITY_STORAGE_KEY);
  if (!rawValue) {
    const seeded = sortEventsDescending(createSeedEvents());
    window.localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      const seeded = sortEventsDescending(createSeedEvents());
      window.localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }

    const normalized = parsed
      .map((event, index) => normalizeActivityEvent(event, index))
      .filter((event): event is ActivityEvent => Boolean(event));

    if (normalized.length === 0) {
      const seeded = sortEventsDescending(createSeedEvents());
      window.localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }

    const sorted = sortEventsDescending(normalized);
    window.localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(sorted));
    return sorted;
  } catch {
    const seeded = sortEventsDescending(createSeedEvents());
    window.localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

export function loadActivityEvents(): ActivityEvent[] {
  return readActivityEventsFromStorage();
}

export function persistActivityEvents(events: ActivityEvent[]) {
  if (typeof window === "undefined") {
    return;
  }

  const capped = sortEventsDescending(events).slice(0, MAX_STORED_EVENTS);
  window.localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(capped));
}

export function logActivity(input: ActivityLogInput): ActivityEvent {
  const event: ActivityEvent = {
    id: createEventId(),
    type: input.type,
    title: input.title.trim(),
    description: (input.description ?? "").trim(),
    projectId:
      input.projectId === null || input.projectId === undefined || input.projectId === ""
        ? null
        : String(input.projectId),
    projectName: (input.projectName ?? "").trim(),
    actor: input.actor,
    createdAt: input.createdAt ?? new Date().toISOString(),
    metadata: input.metadata ?? {}
  };

  const existing = loadActivityEvents();
  persistActivityEvents([event, ...existing]);
  return event;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function groupActivityEventsByDate(events: ActivityEvent[]): ActivityGroup[] {
  const now = new Date();
  const startToday = startOfDay(now);
  const startYesterday = startToday - 24 * 60 * 60 * 1000;
  const startThisWeek = startToday - 7 * 24 * 60 * 60 * 1000;

  const groups: ActivityGroup[] = [
    { label: "Today", events: [] },
    { label: "Yesterday", events: [] },
    { label: "This Week", events: [] },
    { label: "Older", events: [] }
  ];

  for (const event of sortEventsDescending(events)) {
    const createdAt = new Date(event.createdAt).getTime();

    if (createdAt >= startToday) {
      groups[0].events.push(event);
      continue;
    }
    if (createdAt >= startYesterday) {
      groups[1].events.push(event);
      continue;
    }
    if (createdAt >= startThisWeek) {
      groups[2].events.push(event);
      continue;
    }
    groups[3].events.push(event);
  }

  return groups.filter((group) => group.events.length > 0);
}

export function formatActivityTimestamp(dateValue: string) {
  const date = new Date(dateValue);
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
