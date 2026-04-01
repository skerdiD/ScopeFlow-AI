import { LogOut, PlusCircle } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

  return {
    title: "ScopeFlow AI",
    subtitle: "AI proposal workspace"
  };
}

export function Topbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const pageContext = getPageContext(pathname);
  const avatarText = (user?.email?.[0] ?? "S").toUpperCase();
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
          <ThemeToggle />

          {canShowPrimaryCta ? (
            <Button onClick={() => navigate("/projects/new")} className="shadow-sm">
              <PlusCircle className="size-4" />
              <span className="hidden sm:inline">Add Project</span>
            </Button>
          ) : null}

          <div className="flex items-center rounded-2xl border bg-background px-2.5 py-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {avatarText}
            </div>
          </div>

          <Button variant="outline" size="icon" onClick={handleLogout} aria-label="Sign out">
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
