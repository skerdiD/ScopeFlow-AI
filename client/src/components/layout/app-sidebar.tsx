import { FolderKanban, LayoutDashboard, PlusCircle, Sparkles } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects/new", label: "New Project", icon: PlusCircle },
  { to: "/dashboard", label: "All Projects", icon: FolderKanban }
];

export function AppSidebar() {
  return (
    <aside className="hidden border-r bg-card lg:flex lg:flex-col">
      <div className="flex h-20 items-center border-b px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </div>
          <div>
            <p className="text-lg font-semibold">ScopeFlow AI</p>
            <p className="text-sm text-muted-foreground">Proposal SaaS</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-6">
        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={`${item.to}-${item.label}`}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )
                }
              >
                <Icon className="size-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
