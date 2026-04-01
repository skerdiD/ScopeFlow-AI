import { LogOut, PlusCircle, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuth } from "@/hooks/use-auth";

export function Topbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await signOut();
      toast.success("Signed out successfully.");
      navigate("/login", { replace: true });
    } catch {
      toast.error("Failed to sign out. Please try again.");
    }
  }

  const avatarText = (user?.email?.[0] ?? "S").toUpperCase();

  return (
    <header className="border-b bg-card">
      <div className="flex h-20 items-center justify-between gap-4 px-4 md:px-6 lg:px-8">
        <div className="flex flex-1 items-center gap-3">
          <div className="hidden items-center gap-3 md:flex">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </div>
            <p className="text-sm font-semibold">ScopeFlow AI</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />

          <Button variant="default" onClick={() => navigate("/projects/new")}>
            <PlusCircle className="size-4" />
            <span className="hidden sm:inline">Add Project</span>
          </Button>

          <div className="flex items-center gap-3 rounded-2xl border bg-background px-3 py-2">
            <div className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {avatarText}
            </div>
          </div>
          <Button variant="outline" size="icon" onClick={handleLogout}>
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
