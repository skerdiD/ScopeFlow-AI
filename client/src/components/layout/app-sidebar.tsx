import { useEffect, useState, type ComponentType } from "react";
import {
  Activity,
  ChevronDown,
  FileStack,
  FolderKanban,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  PlusCircle,
  Settings,
  Sparkles
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

type NavItem = {
  key: string;
  label: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
  match: (pathname: string) => boolean;
  emphasis?: "default" | "subtle";
};

type NavGroup = {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  children: NavItem[];
  match: (pathname: string) => boolean;
};

type AppSidebarProps = {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
};

const dashboardItem: NavItem = {
  key: "dashboard",
  label: "Dashboard",
  to: "/dashboard",
  icon: LayoutDashboard,
  match: (pathname) => pathname === "/dashboard"
};

const projectsGroup: NavGroup = {
  key: "projects",
  label: "Projects",
  icon: FolderKanban,
  match: (pathname) => pathname === "/projects" || pathname.startsWith("/projects/"),
  children: [
    {
      key: "all-projects",
      label: "All Projects",
      to: "/projects",
      icon: FolderKanban,
      match: (pathname) => pathname === "/projects"
    },
    {
      key: "new-project",
      label: "New Project",
      to: "/projects/new",
      icon: PlusCircle,
      match: (pathname) => pathname === "/projects/new",
      emphasis: "subtle"
    }
  ]
};

const secondaryItems: NavItem[] = [
  {
    key: "templates",
    label: "Templates",
    to: "/templates",
    icon: FileStack,
    match: (pathname) => pathname.startsWith("/templates")
  },
  {
    key: "activity",
    label: "Activity",
    to: "/activity",
    icon: Activity,
    match: (pathname) => pathname.startsWith("/activity")
  }
];

const settingsItem: NavItem = {
  key: "settings",
  label: "Settings",
  to: "/settings",
  icon: Settings,
  match: (pathname) => pathname.startsWith("/settings")
};

function CollapsedTooltip({ show, label }: { show: boolean; label: string }) {
  if (!show) {
    return null;
  }

  return (
    <span className="pointer-events-none absolute left-full top-1/2 z-40 ml-2 -translate-y-1/2 rounded-lg border bg-popover px-2 py-1 text-xs font-medium text-popover-foreground opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100">
      {label}
    </span>
  );
}

type SidebarItemProps = {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  nested?: boolean;
};

function SidebarItem({ item, active, collapsed, nested = false }: SidebarItemProps) {
  const Icon = item.icon;

  return (
    <div className="group relative">
      <NavLink
        to={item.to}
        aria-label={item.label}
        title={collapsed ? item.label : undefined}
        className={cn(
          "flex items-center rounded-xl text-sm font-medium transition-all duration-200",
          collapsed ? "h-10 justify-center" : "h-10 gap-3 px-3",
          nested && !collapsed ? "ml-7 h-9 rounded-lg text-[13px]" : "",
          active
            ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.16)]"
            : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
          item.emphasis === "subtle" && !active ? "text-foreground/85" : ""
        )}
      >
        <Icon className={cn("shrink-0", nested ? "size-[15px]" : "size-4")} />
        {!collapsed ? <span className="truncate">{item.label}</span> : null}
      </NavLink>
      <CollapsedTooltip show={collapsed} label={item.label} />
    </div>
  );
}

export function AppSidebar({ collapsed, onCollapsedChange }: AppSidebarProps) {
  const { pathname } = useLocation();
  const projectsActive = projectsGroup.match(pathname);
  const [projectsOpen, setProjectsOpen] = useState<boolean>(projectsActive);

  useEffect(() => {
    if (projectsActive) {
      setProjectsOpen(true);
    }
  }, [projectsActive]);

  useEffect(() => {
    if (collapsed) {
      setProjectsOpen(false);
    } else if (projectsActive) {
      setProjectsOpen(true);
    }
  }, [collapsed, projectsActive]);

  const GroupIcon = projectsGroup.icon;

  return (
    <aside
      className={cn(
        "hidden border-r bg-card/95 backdrop-blur lg:flex lg:flex-col",
        "transition-[width] duration-300 ease-out",
        collapsed ? "w-[84px]" : "w-[280px]"
      )}
    >
      <div className="flex h-20 items-center border-b px-3">
        <div className={cn("flex w-full items-center", collapsed ? "justify-center" : "justify-between gap-3")}>
          <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </div>
            {!collapsed ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">ScopeFlow AI</p>
                <p className="truncate text-xs text-muted-foreground">Proposal workspace</p>
              </div>
            ) : null}
          </div>

          {!collapsed ? (
            <button
              type="button"
              onClick={() => onCollapsedChange(true)}
              className="rounded-lg p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="size-4" />
            </button>
          ) : null}
        </div>
      </div>

      {collapsed ? (
        <div className="px-3 pt-3">
          <button
            type="button"
            onClick={() => onCollapsedChange(false)}
            className="group relative flex h-10 w-full items-center justify-center rounded-xl text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <PanelLeftOpen className="size-4" />
            <CollapsedTooltip show label="Expand sidebar" />
          </button>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <nav className="space-y-1.5">
          <SidebarItem item={dashboardItem} active={dashboardItem.match(pathname)} collapsed={collapsed} />

          {collapsed ? (
            <SidebarItem
              item={{
                key: projectsGroup.key,
                label: projectsGroup.label,
                to: "/projects",
                icon: projectsGroup.icon,
                match: projectsGroup.match
              }}
              active={projectsActive}
              collapsed
            />
          ) : (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setProjectsOpen((open) => !open)}
                className={cn(
                  "flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition-all duration-200",
                  projectsActive
                    ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.16)]"
                    : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                )}
                aria-expanded={projectsOpen}
              >
                <GroupIcon className="size-4 shrink-0" />
                <span className="flex-1 truncate">{projectsGroup.label}</span>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 transition-transform duration-200",
                    projectsOpen ? "rotate-180" : "rotate-0"
                  )}
                />
              </button>

              <div
                className={cn(
                  "grid transition-all duration-200",
                  projectsOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                )}
              >
                <div className="overflow-hidden">
                  <div className="space-y-1 py-1">
                    {projectsGroup.children.map((child) => (
                      <SidebarItem
                        key={child.key}
                        item={child}
                        active={child.match(pathname)}
                        collapsed={false}
                        nested
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {secondaryItems.map((item) => (
            <SidebarItem key={item.key} item={item} active={item.match(pathname)} collapsed={collapsed} />
          ))}
        </nav>
      </div>

      <div className="border-t p-3">
        <SidebarItem item={settingsItem} active={settingsItem.match(pathname)} collapsed={collapsed} />
      </div>
    </aside>
  );
}
