import { Link } from "react-router-dom";
import {
  ArrowRight,
  ChartNoAxesCombined,
  CheckCircle2,
  FileCheck2,
  FolderKanban,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuth } from "@/hooks/use-auth";

const highlights = [
  {
    title: "Structured Proposals",
    description: "Turn rough requirements into clear project scopes with milestones and deliverables.",
    icon: FileCheck2
  },
  {
    title: "Secure Sessions",
    description: "Supabase-powered authentication with protected routes for your workspace.",
    icon: ShieldCheck
  },
  {
    title: "Fast Workflow",
    description: "Create, edit, and track proposal projects from one dashboard.",
    icon: Sparkles
  }
];

const miniStats = [
  { label: "Projects", value: "24" },
  { label: "Drafts", value: "9" },
  { label: "Delivered", value: "15" }
];

export function HomePage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(59,130,246,0.16),transparent_35%),radial-gradient(circle_at_85%_80%,rgba(34,197,94,0.12),transparent_35%)]" />
        <div className="pointer-events-none absolute -left-8 top-24 size-32 rounded-full bg-primary/10 blur-2xl animate-pulse-soft" />
        <div className="pointer-events-none absolute -right-10 top-8 size-40 rounded-full bg-emerald-400/10 blur-2xl animate-float" />

        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-8 lg:px-8 lg:py-20">
          <div className="absolute right-4 top-4 sm:right-6 sm:top-6 lg:right-8">
            <ThemeToggle />
          </div>

          <div>
            <div className="animate-fade-up inline-flex items-center gap-3 rounded-full border bg-card px-4 py-2 text-sm font-medium shadow-sm">
              <span className="flex size-8 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <Sparkles className="size-4" />
              </span>
              <span>ScopeFlow AI</span>
            </div>

            <h1 className="animate-fade-up-delay-1 mt-6 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Build client-ready proposals with less friction.
            </h1>
            <p className="animate-fade-up-delay-2 mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
              A focused workspace for drafting scope, timeline, deliverables, and risks so your team can move from discovery to signed proposal faster.
            </p>

            <div className="animate-fade-up-delay-3 mt-8 flex flex-wrap items-center gap-3">
              {user ? (
                <Button asChild size="lg">
                  <Link to="/dashboard">
                    Open Dashboard
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild size="lg">
                    <Link to="/signup">
                      Start Free
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link to="/login">Sign In</Link>
                  </Button>
                </>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-primary" />
                Protected auth routes
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-primary" />
                Real-time project workflow
              </div>
            </div>
          </div>

          <Card className="animate-fade-up-delay-2 border-border/80 bg-card/95 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <ChartNoAxesCombined className="size-3.5" />
                  Weekly Snapshot
                </div>
                <span className="text-xs text-muted-foreground">Updated now</span>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                {miniStats.map((stat) => (
                  <div key={stat.label} className="rounded-2xl bg-secondary/60 p-3 text-center">
                    <p className="text-xl font-semibold">{stat.value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border bg-background p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FolderKanban className="size-4 text-primary" />
                  Recently edited
                </div>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center justify-between">
                    Mobile App Scope
                    <span className="text-xs">2m ago</span>
                  </li>
                  <li className="flex items-center justify-between">
                    Website Redesign
                    <span className="text-xs">9m ago</span>
                  </li>
                  <li className="flex items-center justify-between">
                    CRM Migration
                    <span className="text-xs">18m ago</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {highlights.map((item, index) => {
            const Icon = item.icon;
            const delayClass =
              index === 0
                ? "animate-fade-up"
                : index === 1
                  ? "animate-fade-up-delay-1"
                  : "animate-fade-up-delay-2";

            return (
              <Card
                key={item.title}
                className={`${delayClass} border-border/80 bg-card/90 transition duration-300 hover:-translate-y-1 hover:shadow-lg`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold">{item.title}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-8 rounded-3xl border bg-card p-6 sm:p-8">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-primary" />
              Auth + protected routes ready
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-primary" />
              Supabase session persistence
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-primary" />
              Proposal CRUD dashboard
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
