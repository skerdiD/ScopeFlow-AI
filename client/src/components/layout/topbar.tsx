import { Bell, LogOut, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  const email = user?.email ?? "you@example.com";
  const avatarText = (user?.email?.[0] ?? "S").toUpperCase();

  return (
    <header className="border-b bg-card">
      <div className="flex h-20 items-center justify-between gap-4 px-4 md:px-6 lg:px-8">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative hidden max-w-xl flex-1 md:block">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search projects..." />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button variant="outline" size="icon">
            <Bell className="size-4" />
          </Button>
          <div className="flex items-center gap-3 rounded-2xl border bg-background px-3 py-2">
            <div className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {avatarText}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium">Workspace</p>
              <p className="text-xs text-muted-foreground">{email}</p>
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
