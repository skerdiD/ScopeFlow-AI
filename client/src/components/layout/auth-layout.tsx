import { Outlet } from "react-router-dom";
import { Sparkles, ShieldCheck, FileText } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const highlights = [
  {
    icon: Sparkles,
    title: "AI proposal generation",
    description: "Turn messy client notes into structured scope documents."
  },
  {
    icon: ShieldCheck,
    title: "Secure workspace",
    description: "Session persistence and protected access for your projects."
  },
  {
    icon: FileText,
    title: "Professional output",
    description: "Refine and export polished proposals for clients."
  }
];

export function AuthLayout() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.08),transparent_30%)]" />
      <div className="absolute right-4 top-4 z-20 lg:right-8 lg:top-8">
        <ThemeToggle />
      </div>
      <div className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-4 py-10 lg:grid-cols-[1.1fr_520px] lg:px-8">
        <div className="mx-auto flex w-full max-w-md items-center justify-center lg:hidden">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium shadow-sm">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </span>
            ScopeFlow AI
          </div>
        </div>

        <div className="hidden lg:block">
          <div className="max-w-xl space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium shadow-sm">
              <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Sparkles className="size-4" />
              </span>
              ScopeFlow AI
            </div>

            <div className="space-y-4">
              <h1 className="text-5xl font-semibold tracking-tight text-foreground">
                Build clear proposals your clients trust.
              </h1>
              <p className="max-w-lg text-lg text-muted-foreground">
                Plan scope, timeline, risks, and deliverables from one clean workflow built for proposal teams.
              </p>
            </div>

            <div className="grid gap-4">
              {highlights.map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.title} className="rounded-[1.5rem] border bg-card/90 p-5 shadow-sm backdrop-blur">
                    <div className="flex items-start gap-4">
                      <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                        <Icon className="size-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-semibold">{item.title}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-md">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
