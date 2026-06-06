import { CreditCard, LogOut, PlusCircle, Settings, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuth } from "@/hooks/use-auth";

type PageContext = {
  title: string;
  subtitle: string;
};

function getPageContext(pathname: string): PageContext {
  if (pathname === "/dashboard") {
    return {
      title: "Dashboard",
      subtitle: "Track proposal performance, delivery progress, and recent work."
    };
  }

  if (pathname === "/projects") {
    return {
      title: "All Projects",
      subtitle: "Manage project proposals, statuses, and client delivery timelines."
    };
  }

  if (pathname === "/projects/new") {
    return {
      title: "New Project",
      subtitle: "Capture key discovery input and generate a polished proposal."
    };
  }

  if (pathname.startsWith("/projects/")) {
    return {
      title: "Project Details",
      subtitle: "Edit scope, track versions, and finalize your proposal."
    };
  }

  if (pathname.startsWith("/templates")) {
    if (pathname === "/templates/new") {
      return {
        title: "Add Template",
        subtitle: "Create reusable proposal templates manually or with AI-generated draft content."
      };
    }

    if (pathname.startsWith("/templates/") && pathname.endsWith("/edit")) {
      return {
        title: "Edit Template",
        subtitle: "Update template content and default section structure for consistent proposals."
      };
    }

    return {
      title: "Templates",
      subtitle: "Maintain reusable proposal structures for consistent delivery."
    };
  }

  if (pathname.startsWith("/activity")) {
    return {
      title: "Activity",
      subtitle: "Review recent project updates and workspace changes."
    };
  }

  if (pathname.startsWith("/settings")) {
    return {
      title: "Settings",
      subtitle: "Configure workspace behavior and proposal preferences."
    };
  }

  if (pathname.startsWith("/profile")) {
    return {
      title: "Profile",
      subtitle: "Review account details and workspace identity."
    };
  }

  if (pathname.startsWith("/billing")) {
    return {
      title: "Usage and Billing",
      subtitle: "Review plan limits and monthly AI proposal generation usage."
    };
  }

  return {
    title: "ScopeFlow AI",
    subtitle: "AI proposal workspace"
  };
}

export function Topbar() {
  const { user, signOut, isDemo } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const pageContext = getPageContext(pathname);
  const avatarText = (user?.email?.[0] ?? "S").toUpperCase();
  const userLabel = user?.user_metadata?.full_name || user?.email || "ScopeFlow user";
  const userEmail = user?.email ?? "";
  const canShowPrimaryCta = pathname !== "/projects/new";

  async function handleLogout() {
    try {
      await signOut();
      toast.success("Signed out successfully.");
      navigate("/login", { replace: true });
    } catch {
      toast.error("Failed to sign out. Please try again.");
    }
  }

  return (
    <header className="border-b bg-card/90 backdrop-blur">
      <div className="flex h-20 items-center justify-between gap-4 px-4 md:px-6 lg:px-8">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold tracking-tight">{pageContext.title}</p>
          <p className="hidden truncate text-sm text-muted-foreground md:block">{pageContext.subtitle}</p>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {isDemo ? <Badge variant="outline">Demo mode</Badge> : null}
          <ThemeToggle />

          {canShowPrimaryCta ? (
            <Button onClick={() => navigate("/projects/new")} className="shadow-sm">
              <PlusCircle className="size-4" />
              <span className="hidden sm:inline">Add Project</span>
            </Button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center rounded-2xl border bg-background px-2.5 py-2 outline-none transition hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Open profile menu"
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {avatarText}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="w-64 p-2 shadow-lg">
              <DropdownMenuLabel className="p-2">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {avatarText}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">{userLabel}</span>
                    {userEmail ? (
                      <span className="block truncate text-xs font-normal text-muted-foreground">{userEmail}</span>
                    ) : null}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="h-9 cursor-pointer gap-2 px-2" onSelect={() => navigate("/profile")}>
                <User className="size-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem className="h-9 cursor-pointer gap-2 px-2" onSelect={() => navigate("/settings")}>
                <Settings className="size-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem className="h-9 cursor-pointer gap-2 px-2" onSelect={() => navigate("/billing")}>
                <CreditCard className="size-4" />
                Usage & Billing
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="h-9 cursor-pointer gap-2 px-2"
                variant="destructive"
                onSelect={() => {
                  void handleLogout();
                }}
              >
                <LogOut className="size-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
