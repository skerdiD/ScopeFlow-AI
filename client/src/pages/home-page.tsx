import { type ReactNode, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileCheck2,
  FileText,
  Gauge,
  Layers3,
  PencilRuler,
  ScanSearch,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Star,
  Target,
  WandSparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Testimonials", href: "#testimonials" },
  { label: "Pricing", href: "#cta" }
];

const problemCards = [
  {
    title: "Hours wasted on formatting",
    description: "Proposal writing gets slow when every project starts with a blank page.",
    icon: Clock3,
    iconClassName: "bg-rose-50 text-rose-600"
  },
  {
    title: "Important details missed",
    description: "Risks and dependencies often vanish between call notes and final proposal.",
    icon: ShieldAlert,
    iconClassName: "bg-amber-50 text-amber-600"
  },
  {
    title: "Inconsistent quality",
    description: "Every teammate writes differently, so outputs feel uneven to clients.",
    icon: ClipboardList,
    iconClassName: "bg-sky-50 text-sky-600"
  },
  {
    title: "Slow responses lose deals",
    description: "Competitors send polished proposals first and win momentum.",
    icon: Target,
    iconClassName: "bg-emerald-50 text-emerald-600"
  }
];

const featureCards = [
  {
    title: "AI proposal generation",
    description: "Generate summary, scope, deliverables, milestones, and risks in one draft.",
    icon: Bot,
    accentClassName: "from-indigo-500 to-blue-500"
  },
  {
    title: "Editable sections",
    description: "Refine any section with a focused editor while preserving structure.",
    icon: PencilRuler,
    accentClassName: "from-sky-500 to-cyan-500"
  },
  {
    title: "Versioning",
    description: "Track revisions and compare updates before sharing with clients.",
    icon: Layers3,
    accentClassName: "from-violet-500 to-indigo-500"
  },
  {
    title: "AI insights",
    description: "Catch missing requirements and timeline risks before proposal delivery.",
    icon: Gauge,
    accentClassName: "from-emerald-500 to-teal-500"
  }
];

const previewHighlights = [
  {
    title: "Proposal sections",
    description: "Automatically organized into a clear, client-friendly format.",
    icon: FileCheck2
  },
  {
    title: "AI insights",
    description: "Guidance for risk, scope creep, and pricing assumptions.",
    icon: ScanSearch
  },
  {
    title: "Editing system",
    description: "Fast edits with versions that keep every iteration clean.",
    icon: FileText
  }
];

const howItWorksSteps = [
  {
    title: "Input project details",
    description: "Paste discovery notes, timelines, budget, and required outcomes."
  },
  {
    title: "AI builds your proposal",
    description: "ScopeFlow AI structures the full draft into professional sections."
  },
  {
    title: "Edit and export",
    description: "Review, adjust, then export a polished PDF or shareable link."
  }
];

const testimonials = [
  {
    quote: "Proposal time dropped from hours to minutes, and the quality is noticeably better.",
    name: "Sarah Chen",
    role: "Freelance Product Designer"
  },
  {
    quote: "We now answer leads faster with cleaner scope and stronger client confidence.",
    name: "Marcus Rodriguez",
    role: "Agency Owner, Blueframe Studio"
  },
  {
    quote: "The risk prompts prevent mistakes we used to catch too late in the process.",
    name: "Emma Thompson",
    role: "Operations Consultant"
  }
];

const trustLogos = ["Freelance Collective", "Northstar Studio", "PixelForge", "GrowthCraft", "Independent PMs"];

const trustStats = [
  { value: "10k+", label: "Proposals generated" },
  { value: "2 min", label: "Average draft time" },
  { value: "98%", label: "Customer satisfaction" },
  { value: "12 hrs", label: "Saved per week" }
];

type FadeUpProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

function FadeUp({ children, className, delay = 0 }: FadeUpProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible(true);
        observer.unobserve(entry.target);
      },
      { threshold: 0.2, rootMargin: "0px 0px -8% 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "translate-y-6 opacity-0 transition-all duration-700 ease-out motion-reduce:translate-y-0 motion-reduce:opacity-100",
        visible && "translate-y-0 opacity-100",
        className
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

type SectionIntroProps = {
  eyebrow: string;
  title: string;
  description: string;
};

function SectionIntro({ eyebrow, title, description }: SectionIntroProps) {
  return (
    <FadeUp className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold text-indigo-600 dark:text-sky-400">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-base text-slate-600 dark:text-slate-300">{description}</p>
    </FadeUp>
  );
}

export function HomePage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <span className="inline-flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-sky-500 text-white">
              <Sparkles className="size-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">ScopeFlow AI</span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm text-slate-600 dark:text-slate-300 md:flex">
            {navLinks.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="transition-colors duration-200 hover:text-slate-900 dark:hover:text-slate-100"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              asChild
              size="sm"
              className="h-9 rounded-xl bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              <Link to={user ? "/dashboard" : "/login"}>{user ? "Dashboard" : "Sign in"}</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-slate-200/80 dark:border-slate-800">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_18%,rgba(59,130,246,0.18),transparent_30%),radial-gradient(circle_at_85%_10%,rgba(14,165,233,0.16),transparent_30%),radial-gradient(circle_at_88%_82%,rgba(99,102,241,0.15),transparent_26%)] dark:opacity-35" />
        <div className="mx-auto grid w-full max-w-7xl items-center gap-14 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[minmax(0,1.03fr)_minmax(0,0.97fr)] lg:px-8 lg:pb-24 lg:pt-20">
          <FadeUp className="relative max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <WandSparkles className="size-3.5 text-indigo-600" />
              Built for freelancers and agencies
            </div>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl lg:text-6xl">
              Win more clients with polished proposals in minutes.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">
              ScopeFlow AI turns messy client requirements into structured proposals with summary, scope, deliverables,
              milestones, and risk coverage.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-xl bg-slate-900 px-6 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                <Link to={user ? "/dashboard" : "/signup"}>
                  {user ? "Open workspace" : "Generate proposal"}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 rounded-xl border-slate-300 px-6 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <a href="#product-preview">See demo</a>
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-5 text-sm text-slate-600 dark:text-slate-300">
              {[
                "Free trial available",
                "No credit card required",
                "Setup in 2 minutes"
              ].map((item) => (
                <span key={item} className="inline-flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  {item}
                </span>
              ))}
            </div>
          </FadeUp>

          <FadeUp delay={100} className="relative">
            <Card className="overflow-hidden rounded-[2rem] border-slate-200 bg-white shadow-[0_35px_110px_-46px_rgba(15,23,42,0.55)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_35px_90px_-42px_rgba(2,6,23,0.9)]">
              <CardContent className="p-0">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                  <span>Proposal workspace</span>
                  <span>Auto-save on</span>
                </div>
                <div className="grid gap-3 p-3 lg:grid-cols-[210px_1fr]">
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Sections</p>
                    {[
                      "Executive summary",
                      "Scope of work",
                      "Deliverables",
                      "Milestones",
                      "Risk analysis"
                    ].map((section, index) => (
                      <div
                        key={section}
                        className="mt-2 flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {section}
                        {index < 3 ? <CheckCircle2 className="size-3.5 text-emerald-500" /> : null}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Website redesign proposal</p>
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          Draft ready
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                        AI structured timelines and dependency risks.
                      </p>
                      <div className="mt-3 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className="h-2 w-[84%] rounded-full bg-gradient-to-r from-indigo-500 to-sky-500 shadow-[0_0_20px_rgba(59,130,246,0.35)]" />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-transform duration-300 hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-900">
                        <div className="inline-flex size-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
                          <CalendarClock className="size-4" />
                        </div>
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Milestones</p>
                        <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">5</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">phases auto-generated</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-transform duration-300 hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-900">
                        <div className="inline-flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
                          <ShieldCheck className="size-4" />
                        </div>
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Risk score</p>
                        <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">Low</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">2 assumptions pending</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="absolute -left-5 top-10 hidden rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-md dark:border-slate-700 dark:bg-slate-900 sm:block">
              <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-200">
                <ScanSearch className="size-3.5 text-indigo-600" />
                Missing dependency flagged
              </span>
            </div>
          </FadeUp>
        </div>
      </section>

      <section
        id="problem"
        className="border-b border-slate-200/80 bg-slate-100/70 py-24 dark:border-slate-800 dark:bg-slate-900/60 sm:py-28"
      >
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionIntro
            eyebrow="The problem"
            title="Proposals should not slow down your sales cycle"
            description="Freelancers and agencies lose momentum when proposal writing is manual and inconsistent."
          />
          <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {problemCards.map((item, index) => {
              const Icon = item.icon;
              return (
                <FadeUp key={item.title} delay={index * 90}>
                  <Card className="h-full rounded-3xl border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
                    <CardContent className="p-6">
                      <span
                        className={cn(
                          "inline-flex size-10 items-center justify-center rounded-2xl shadow-sm",
                          item.iconClassName
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <h3 className="mt-4 text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">{item.title}</h3>
                      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.description}</p>
                    </CardContent>
                  </Card>
                </FadeUp>
              );
            })}
          </div>
        </div>
      </section>

      <section id="solution" className="py-24 sm:py-28">
        <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-14 lg:px-8">
          <FadeUp>
            <p className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-sky-700 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300">
              <Sparkles className="size-3.5" />
              Smart solution
            </p>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
              ScopeFlow AI structures your proposal workflow end-to-end
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">
              From messy call notes to polished deliverables, your team gets clarity, consistency, and speed.
            </p>
            <ul className="mt-8 space-y-4">
              {[
                "Convert rough notes into clean sections.",
                "Generate scope, deliverables, milestones, and risks.",
                "Edit confidently with version history.",
                "Export polished client-ready proposals."
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex size-6 items-center justify-center rounded-full bg-indigo-600 text-white">
                    <CheckCircle2 className="size-4" />
                  </span>
                  <span className="text-sm leading-6 text-slate-700 dark:text-slate-200">{item}</span>
                </li>
              ))}
            </ul>
          </FadeUp>

          <FadeUp delay={120}>
            <Card className="rounded-[2rem] border-slate-200 bg-white p-1 shadow-[0_26px_80px_-42px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-900">
              <CardContent className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Raw discovery notes</p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                    &quot;Need ecommerce redesign, uncertain timeline, migration planning, and content ops support.&quot;
                  </p>
                </div>
                <div className="my-3 flex justify-center">
                  <span className="inline-flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-sky-500 text-white">
                    <WandSparkles className="size-4" />
                  </span>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs text-slate-500 dark:text-slate-400">ScopeFlow AI output</p>
                  {["Executive summary", "Scope and deliverables", "Milestones", "Risk analysis"].map((item) => (
                    <div
                      key={item}
                      className="mt-2 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {item}
                      <CheckCircle2 className="size-3.5 text-emerald-500" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </FadeUp>
        </div>
      </section>
      <section id="features" className="border-y border-slate-200/80 bg-white py-24 dark:border-slate-800 dark:bg-slate-950 sm:py-28">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionIntro
            eyebrow="Features"
            title="Everything you need to close deals faster"
            description="Designed for high-quality proposals without manual template overhead."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {featureCards.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <FadeUp key={feature.title} delay={index * 90}>
                  <Card className="h-full rounded-3xl border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900">
                    <CardContent className="p-6">
                      <span
                        className={cn(
                          "inline-flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-sm",
                          feature.accentClassName
                        )}
                      >
                        <Icon className="size-5" />
                      </span>
                      <h3 className="mt-5 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{feature.title}</h3>
                      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{feature.description}</p>
                      <p className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-indigo-700 dark:text-sky-400">
                        Learn more
                        <ChevronRight className="size-4" />
                      </p>
                    </CardContent>
                  </Card>
                </FadeUp>
              );
            })}
          </div>
        </div>
      </section>

      <section id="product-preview" className="bg-slate-50 py-24 dark:bg-slate-900 sm:py-28">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionIntro
            eyebrow="Product preview"
            title="Built for speed, structure, and confidence"
            description="A focused interface that keeps proposal quality high while moving fast."
          />
          <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <FadeUp>
              <Card className="overflow-hidden rounded-[2rem] border-slate-200 bg-white shadow-[0_30px_100px_-44px_rgba(15,23,42,0.5)] dark:border-slate-800 dark:bg-slate-900">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                    <span>Proposal editor</span>
                    <span>Auto-save enabled</span>
                  </div>
                  <div className="grid gap-4 p-5 lg:grid-cols-2">
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Project summary</p>
                        <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">AI-generated overview aligned to client outcomes.</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Deliverables</p>
                        {["UX audit and IA", "Design system", "CMS handoff"].map((item) => (
                          <div
                            key={item}
                            className="mt-2 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          >
                            <span className="size-1.5 rounded-full bg-slate-400" />
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                        <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">AI insights</p>
                        <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                          Add migration contingency for legacy plugins.
                        </div>
                        <div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
                          Timeline confidence improved with phased rollout.
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                        <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Version history</p>
                        <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          v2.1 revised timeline
                          <span>Now</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          v2.0 deliverables update
                          <span>1h</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </FadeUp>
            <div className="space-y-4">
              {previewHighlights.map((item, index) => {
                const Icon = item.icon;
                return (
                  <FadeUp key={item.title} delay={index * 90}>
                    <Card className="rounded-3xl border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                      <CardContent className="p-6">
                        <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-slate-800">
                          <Icon className="size-4" />
                        </span>
                        <h3 className="mt-4 text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">{item.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.description}</p>
                      </CardContent>
                    </Card>
                  </FadeUp>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-24 sm:py-28">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionIntro
            eyebrow="How it works"
            title="From client call to proposal in 3 clear steps"
            description="A guided workflow that keeps your process simple and repeatable."
          />
          <div className="relative mt-12 grid gap-5 md:grid-cols-3">
            <div className="pointer-events-none absolute left-[16.67%] right-[16.67%] top-7 hidden h-px bg-gradient-to-r from-indigo-200 via-sky-300 to-indigo-200 md:block" />
            {howItWorksSteps.map((step, index) => (
              <FadeUp key={step.title} delay={index * 90}>
                <Card className="h-full rounded-3xl border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
                  <CardContent className="p-6">
                    <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 text-base font-semibold text-white">
                      {index + 1}
                    </span>
                    <h3 className="mt-5 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{step.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{step.description}</p>
                  </CardContent>
                </Card>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>
      <section id="testimonials" className="border-y border-slate-200/80 bg-white py-24 dark:border-slate-800 dark:bg-slate-950 sm:py-28">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionIntro
            eyebrow="Trusted by teams"
            title="Loved by freelancers and agencies"
            description="Built for professionals who need proposal quality, speed, and consistency."
          />
          <FadeUp delay={80} className="mt-10">
            <div className="flex flex-wrap items-center justify-center gap-3">
              {trustLogos.map((logo) => (
                <span
                  key={logo}
                  className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                >
                  {logo}
                </span>
              ))}
            </div>
          </FadeUp>
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {testimonials.map((item, index) => (
              <FadeUp key={item.name} delay={index * 90}>
                <Card className="h-full rounded-3xl border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <CardContent className="p-6">
                    <div className="mb-4 inline-flex items-center gap-1 text-amber-500">
                      {Array.from({ length: 5 }).map((_, starIndex) => (
                        <Star key={starIndex} className="size-4 fill-current" />
                      ))}
                    </div>
                    <p className="text-sm leading-7 text-slate-700 dark:text-slate-200">&quot;{item.quote}&quot;</p>
                    <p className="mt-5 text-sm font-semibold text-slate-900 dark:text-slate-100">{item.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{item.role}</p>
                  </CardContent>
                </Card>
              </FadeUp>
            ))}
          </div>
          <div className="mt-10 grid gap-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-6 dark:border-slate-800 dark:bg-slate-900/60 sm:grid-cols-2 lg:grid-cols-4">
            {trustStats.map((item, index) => (
              <FadeUp key={item.label} delay={index * 80}>
                <div className="text-center">
                  <p className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{item.value}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.label}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      <section id="cta" className="py-24 sm:py-28">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeUp>
            <div className="overflow-hidden rounded-[2.2rem] border border-indigo-300/40 bg-[radial-gradient(circle_at_15%_15%,rgba(125,211,252,0.35),transparent_40%),radial-gradient(circle_at_88%_78%,rgba(99,102,241,0.5),transparent_45%),linear-gradient(140deg,#1f2568_0%,#3344c4_45%,#1d4ed8_100%)] px-6 py-14 text-center text-white shadow-[0_30px_100px_-35px_rgba(30,64,175,0.65)] sm:px-10">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-100">Get started</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">Ready to win more clients?</h2>
              <p className="mx-auto mt-4 max-w-2xl text-base text-sky-100/90 sm:text-lg">
                Turn every client conversation into a professional proposal your prospects can trust.
              </p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="lg" className="h-12 rounded-xl bg-white px-6 text-slate-900 hover:bg-sky-50">
                  <Link to={user ? "/dashboard" : "/signup"}>
                    {user ? "Open dashboard" : "Start free trial"}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-xl border-white/40 bg-white/10 px-6 text-white hover:bg-white/20"
                >
                  <a href="#how-it-works">See how it works</a>
                </Button>
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-5 text-sm text-sky-100">
                {["14-day trial", "No credit card", "Cancel anytime"].map((item) => (
                  <span key={item} className="inline-flex items-center gap-2">
                    <CheckCircle2 className="size-4" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-slate-950 text-slate-300">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr] lg:px-8">
          <div>
            <Link to="/" className="inline-flex items-center gap-2.5">
              <span className="inline-flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 text-white">
                <Sparkles className="size-4" />
              </span>
              <span className="text-sm font-semibold text-white">ScopeFlow AI</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-6 text-slate-400">
              AI-powered proposal workspace for freelancers and agencies that need speed with professional quality.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Product</p>
            <div className="mt-4 space-y-2 text-sm text-slate-400">
              <a href="#features" className="block transition-colors hover:text-white">Features</a>
              <a href="#product-preview" className="block transition-colors hover:text-white">Preview</a>
              <a href="#how-it-works" className="block transition-colors hover:text-white">How it works</a>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Company</p>
            <div className="mt-4 space-y-2 text-sm text-slate-400">
              <a href="#testimonials" className="block transition-colors hover:text-white">Customers</a>
              <a href="#cta" className="block transition-colors hover:text-white">Pricing</a>
              <Link to="/login" className="block transition-colors hover:text-white">Sign in</Link>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Contact</p>
            <div className="mt-4 space-y-2 text-sm text-slate-400">
              <a href="mailto:hello@scopeflow.ai" className="block transition-colors hover:text-white">
                hello@scopeflow.ai
              </a>
              <p>Berlin, Germany</p>
              <p>Support response under 24h</p>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-800">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-slate-500 sm:px-6 lg:px-8">
            <span>(c) 2026 ScopeFlow AI. All rights reserved.</span>
            <span>Built for freelancers and agencies.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

