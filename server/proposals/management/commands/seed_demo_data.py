from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from proposals.models import AIQualityReview, AIUsageLog, ProposalProject, ProposalVersion, UsageRecord, UserPlan
from proposals.services.usage_service import AIUsageService


DEMO_EMAIL = "mirejemi896@gmail.com"
DEMO_USERNAME_PREFIX = "demo-seed-"
DEMO_FIRST_NAME = "Alex"
DEMO_LAST_NAME = "Morgan"


@dataclass(frozen=True)
class DemoProject:
    project_name: str
    client_name: str
    project_type: str
    budget: str
    timeline: str
    status: str
    days_ago_created: int
    days_ago_updated: int
    summary: str
    scope: list[str]
    deliverables: list[str]
    milestones: list[str]
    proposal_timeline: list[str]
    pricing: list[str]
    risks: list[str]
    next_steps: list[str]
    version_count: int
    final: bool = False


DEMO_PROJECTS = [
    DemoProject(
        project_name="SaaS Landing Page Proposal",
        client_name="Northstar Labs",
        project_type="Landing Page",
        budget="$8,000 - $12,000",
        timeline="3-4 weeks",
        status="completed",
        days_ago_created=29,
        days_ago_updated=3,
        summary="A conversion-focused SaaS landing page for Northstar Labs, designed to explain the product clearly, support paid traffic, and move qualified visitors toward demo booking.",
        scope=[
            "Discovery workshop to clarify positioning, audience segments, and conversion goals",
            "High-converting page structure for hero, social proof, feature, pricing, and FAQ sections",
            "Responsive UI design with lightweight animation and reusable content blocks",
            "Implementation handoff with launch checklist and analytics event recommendations",
        ],
        deliverables=[
            "Landing page wireframe and content hierarchy",
            "Polished responsive visual design",
            "Production-ready landing page implementation",
            "Analytics and conversion tracking recommendations",
            "Launch QA checklist",
        ],
        milestones=[
            "Discovery: Confirm offer, audience, and campaign goals.",
            "UX Direction: Approve page structure and messaging flow.",
            "Design Build: Produce responsive interface and reusable sections.",
            "Launch QA: Test responsiveness, tracking, and final copy.",
        ],
        proposal_timeline=["Week 1: Discovery and wireframe", "Week 2: Visual design", "Weeks 3-4: Build, QA, and launch"],
        pricing=["Fixed project fee: $10,500", "50% deposit to begin", "50% due before launch"],
        risks=["Delayed copy approval may shift launch timing.", "Additional page variants may require a separate scope."],
        next_steps=["Approve proposal", "Schedule kickoff call", "Share brand assets and analytics access"],
        version_count=3,
        final=True,
    ),
    DemoProject(
        project_name="AI Chatbot Integration",
        client_name="BrightDesk Support",
        project_type="AI Automation",
        budget="$18,000 - $28,000",
        timeline="6-8 weeks",
        status="in_review",
        days_ago_created=24,
        days_ago_updated=1,
        summary="An AI chatbot integration that helps BrightDesk Support answer common customer questions, escalate complex tickets, and reduce repetitive support workload without replacing human review.",
        scope=[
            "Map support intents, escalation rules, and knowledge base coverage",
            "Design chatbot conversation flows and fallback states",
            "Integrate AI responses with support platform handoff workflow",
            "Configure testing, monitoring, and answer quality review process",
        ],
        deliverables=[
            "Conversation flow map",
            "AI prompt and response guardrail documentation",
            "Support platform integration",
            "Admin testing checklist",
            "Launch monitoring plan",
        ],
        milestones=[
            "Discovery: Audit support workflows and knowledge base content.",
            "Prototype: Validate conversation flows and escalation paths.",
            "Integration: Connect chatbot experience to support tooling.",
            "Pilot: Test with sample tickets and refine answer quality.",
        ],
        proposal_timeline=["Weeks 1-2: Discovery and flow design", "Weeks 3-5: Integration", "Weeks 6-8: QA, pilot, and launch"],
        pricing=["Implementation range: $18,000 - $28,000", "Final pricing depends on support platform complexity"],
        risks=["Incomplete knowledge base content may reduce answer quality.", "Third-party platform limits can affect escalation behavior."],
        next_steps=["Confirm support platform access", "Identify top 25 support intents", "Approve pilot success criteria"],
        version_count=2,
    ),
    DemoProject(
        project_name="E-commerce Redesign",
        client_name="Maven & Co.",
        project_type="E-commerce",
        budget="$22,000 - $35,000",
        timeline="8-10 weeks",
        status="completed",
        days_ago_created=27,
        days_ago_updated=6,
        summary="A storefront redesign for Maven & Co. focused on product discovery, checkout clarity, mobile speed, and higher confidence throughout the buying journey.",
        scope=[
            "Audit current storefront UX, product taxonomy, and checkout friction",
            "Redesign product listing, product detail, cart, and checkout entry points",
            "Improve mobile navigation and promotional merchandising areas",
            "Support launch QA and analytics tracking validation",
        ],
        deliverables=[
            "UX audit summary",
            "Responsive storefront design system",
            "Product and checkout page designs",
            "Implementation-ready component specs",
            "Launch QA and tracking checklist",
        ],
        milestones=[
            "Audit: Review analytics, UX friction, and product flow.",
            "Design System: Create reusable storefront components.",
            "Core Screens: Design PLP, PDP, cart, and checkout entry.",
            "Launch Support: QA and refine critical buying paths.",
        ],
        proposal_timeline=["Weeks 1-2: Audit and strategy", "Weeks 3-6: Design", "Weeks 7-10: Implementation support and QA"],
        pricing=["Estimated project range: $22,000 - $35,000", "Optional post-launch optimization billed separately"],
        risks=["Product content gaps can slow page completion.", "Checkout constraints may depend on platform limitations."],
        next_steps=["Approve redesign direction", "Share analytics and product catalog access", "Schedule stakeholder review"],
        version_count=3,
        final=True,
    ),
    DemoProject(
        project_name="Real Estate CRM Dashboard",
        client_name="Harbor Realty Group",
        project_type="Dashboard",
        budget="$30,000 - $45,000",
        timeline="10-12 weeks",
        status="in_review",
        days_ago_created=21,
        days_ago_updated=2,
        summary="A CRM dashboard for Harbor Realty Group that centralizes leads, agent follow-ups, property activity, and pipeline reporting in one focused workspace.",
        scope=[
            "Define CRM roles, lead stages, and reporting needs",
            "Design dashboard views for agents, managers, and administrators",
            "Build lead pipeline, property notes, reminders, and reporting modules",
            "Prepare deployment, data import, and team onboarding plan",
        ],
        deliverables=[
            "Dashboard information architecture",
            "Role-based CRM workflow design",
            "Lead and property management modules",
            "Reporting dashboard",
            "Deployment and onboarding checklist",
        ],
        milestones=[
            "Planning: Confirm roles, lead stages, and data needs.",
            "UX Design: Approve dashboard flows and core screens.",
            "Build: Implement CRM modules and reporting views.",
            "Launch: Import initial data and train the team.",
        ],
        proposal_timeline=["Weeks 1-2: Planning", "Weeks 3-5: UX/UI", "Weeks 6-10: Build", "Weeks 11-12: QA and launch"],
        pricing=["Estimated build range: $30,000 - $45,000", "Data migration complexity may affect final cost"],
        risks=["Legacy lead data may require cleanup before import.", "Unclear reporting definitions can cause rework."],
        next_steps=["Confirm CRM fields", "Share sample lead data", "Approve dashboard priorities"],
        version_count=2,
    ),
    DemoProject(
        project_name="Restaurant Booking Platform",
        client_name="Casa Verde Kitchen",
        project_type="Booking Platform",
        budget="$16,000 - $24,000",
        timeline="6-7 weeks",
        status="draft",
        days_ago_created=18,
        days_ago_updated=12,
        summary="A reservation platform for Casa Verde Kitchen that lets guests book tables, helps staff manage availability, and reduces manual booking coordination.",
        scope=[
            "Define reservation rules, seating capacity, and staff workflows",
            "Design guest booking flow and admin availability controls",
            "Implement booking confirmation, cancellation, and notification logic",
            "Prepare launch testing for peak service times",
        ],
        deliverables=[
            "Reservation workflow map",
            "Guest booking interface",
            "Admin availability controls",
            "Email notification templates",
            "Launch support checklist",
        ],
        milestones=[
            "Discovery: Confirm table rules and service windows.",
            "Design: Approve guest and admin booking flows.",
            "Build: Implement booking and notification logic.",
            "Launch: Test availability and staff workflows.",
        ],
        proposal_timeline=["Week 1: Requirements", "Weeks 2-3: Design", "Weeks 4-6: Build", "Week 7: QA and launch"],
        pricing=["Fixed project fee estimate: $19,500", "SMS notifications quoted separately if needed"],
        risks=["Changing seating rules late may affect booking logic.", "Third-party notification costs are not included."],
        next_steps=["Confirm booking rules", "Choose notification channels", "Approve initial UX direction"],
        version_count=1,
    ),
    DemoProject(
        project_name="Startup MVP Build",
        client_name="OrbitTask",
        project_type="SaaS MVP",
        budget="$40,000 - $65,000",
        timeline="12-14 weeks",
        status="in_review",
        days_ago_created=15,
        days_ago_updated=4,
        summary="A focused MVP build for OrbitTask that validates the core task automation workflow, supports authenticated users, and provides enough product polish for early customer pilots.",
        scope=[
            "Define MVP feature boundaries, user roles, and release criteria",
            "Design core onboarding, workspace, and automation setup flows",
            "Build authenticated web app with primary workflow and admin visibility",
            "Deploy production environment with monitoring and handover documentation",
        ],
        deliverables=[
            "MVP product scope document",
            "Clickable UX prototype",
            "Production-ready web application",
            "Admin controls for pilot management",
            "Technical handover documentation",
        ],
        milestones=[
            "Scope Lock: Confirm MVP boundaries and success criteria.",
            "Prototype: Validate core workflows with stakeholders.",
            "Build Sprint: Implement product foundation and workflows.",
            "Pilot Launch: Deploy, monitor, and support early users.",
        ],
        proposal_timeline=["Weeks 1-2: Scope and UX", "Weeks 3-5: Prototype and design", "Weeks 6-12: Build", "Weeks 13-14: Pilot launch"],
        pricing=["Estimated MVP range: $40,000 - $65,000", "Ongoing product support available after launch"],
        risks=["Expanding MVP scope may affect pilot timing.", "Third-party API limits may require workflow adjustments."],
        next_steps=["Prioritize MVP requirements", "Confirm pilot user group", "Approve technical architecture"],
        version_count=3,
    ),
    DemoProject(
        project_name="Automation Workflow Setup",
        client_name="LedgerSpring Finance",
        project_type="Workflow Automation",
        budget="$9,000 - $15,000",
        timeline="4-5 weeks",
        status="completed",
        days_ago_created=13,
        days_ago_updated=5,
        summary="A workflow automation setup for LedgerSpring Finance that reduces manual handoffs across intake, document review, and client follow-up processes.",
        scope=[
            "Audit current operational workflow and identify repetitive handoffs",
            "Design automation map with triggers, approvals, and fallback states",
            "Configure workflow automation across selected tools",
            "Document maintenance steps and exception handling",
        ],
        deliverables=[
            "Workflow audit and automation map",
            "Configured automation scenarios",
            "Approval and exception handling rules",
            "Team handover documentation",
            "Post-launch stabilization checklist",
        ],
        milestones=[
            "Audit: Map current process and automation opportunities.",
            "Design: Confirm triggers, approvals, and edge cases.",
            "Configure: Build and test automation workflows.",
            "Handover: Train team and document maintenance steps.",
        ],
        proposal_timeline=["Week 1: Audit", "Week 2: Workflow design", "Weeks 3-4: Configuration", "Week 5: QA and handover"],
        pricing=["Fixed setup fee: $12,000", "Additional workflow branches billed separately"],
        risks=["Tool permission limits may require admin involvement.", "Unclear exception rules can create manual cleanup."],
        next_steps=["Share tool access", "Confirm priority workflows", "Approve automation map"],
        version_count=3,
        final=True,
    ),
    DemoProject(
        project_name="Fitness Coaching Website",
        client_name="Elevate Performance",
        project_type="Website",
        budget="$7,500 - $11,000",
        timeline="4 weeks",
        status="draft",
        days_ago_created=10,
        days_ago_updated=8,
        summary="A modern coaching website for Elevate Performance that presents coaching packages, client outcomes, and inquiry paths for prospective athletes and professionals.",
        scope=[
            "Clarify site structure, offer positioning, and lead capture needs",
            "Design homepage, coaching package, about, and contact experiences",
            "Build responsive website with CMS-ready content sections",
            "Prepare launch QA and basic SEO setup",
        ],
        deliverables=[
            "Website sitemap and section plan",
            "Responsive page designs",
            "Production website implementation",
            "Lead capture form setup",
            "SEO and launch checklist",
        ],
        milestones=[
            "Planning: Confirm offers, pages, and content needs.",
            "Design: Approve visual direction and page layouts.",
            "Build: Implement responsive website.",
            "Launch: QA, SEO checks, and handover.",
        ],
        proposal_timeline=["Week 1: Planning", "Week 2: Design", "Week 3: Build", "Week 4: QA and launch"],
        pricing=["Fixed project fee: $9,000", "Brand photography not included"],
        risks=["Missing testimonials or imagery may reduce page impact.", "Late content changes can delay launch."],
        next_steps=["Confirm coaching packages", "Share brand assets", "Approve sitemap"],
        version_count=1,
    ),
    DemoProject(
        project_name="Analytics Dashboard Build",
        client_name="PulseMetrics",
        project_type="Analytics Dashboard",
        budget="$28,000 - $42,000",
        timeline="8-9 weeks",
        status="in_review",
        days_ago_created=7,
        days_ago_updated=1,
        summary="An analytics dashboard for PulseMetrics that gives leadership a clear view of product adoption, revenue signals, and operational trends without manual spreadsheet reporting.",
        scope=[
            "Define key metrics, source systems, and dashboard user roles",
            "Design executive and operational dashboard views",
            "Build data visualization layer with filters and saved views",
            "Validate data quality and prepare dashboard handover",
        ],
        deliverables=[
            "Metric definition worksheet",
            "Dashboard UX/UI design",
            "Interactive analytics dashboard",
            "Data validation checklist",
            "Admin handover guide",
        ],
        milestones=[
            "Metric Definition: Confirm KPIs and data ownership.",
            "Dashboard Design: Approve layout and filter behavior.",
            "Implementation: Build charts, tables, and saved views.",
            "Validation: QA data accuracy and release dashboard.",
        ],
        proposal_timeline=["Weeks 1-2: Metrics and data planning", "Weeks 3-4: Design", "Weeks 5-8: Build", "Week 9: Validation"],
        pricing=["Estimated range: $28,000 - $42,000", "Data warehouse changes are scoped separately"],
        risks=["Data inconsistencies may require cleanup before launch.", "Metric definitions must be agreed early to avoid rework."],
        next_steps=["Share sample reports", "Confirm KPI owners", "Approve dashboard priority views"],
        version_count=2,
    ),
    DemoProject(
        project_name="Agency Retainer Proposal",
        client_name="BluePeak Studio",
        project_type="Retainer",
        budget="$6,000/month",
        timeline="Monthly retainer",
        status="completed",
        days_ago_created=5,
        days_ago_updated=0,
        summary="A monthly agency retainer for BluePeak Studio covering landing page iteration, campaign support, analytics review, and fast-turnaround design improvements.",
        scope=[
            "Maintain monthly backlog for campaign and website improvements",
            "Design and implement landing page updates, experiments, and content blocks",
            "Review analytics and recommend conversion improvements",
            "Provide predictable weekly communication and priority handling",
        ],
        deliverables=[
            "Monthly priority roadmap",
            "Landing page and campaign updates",
            "Analytics review summary",
            "Design and content iteration support",
            "Monthly performance recap",
        ],
        milestones=[
            "Kickoff: Confirm backlog, cadence, and communication process.",
            "Weekly Delivery: Ship prioritized updates and experiments.",
            "Monthly Review: Review performance and plan next sprint.",
        ],
        proposal_timeline=["Monthly cadence with weekly delivery checkpoints", "First month includes kickoff and backlog setup"],
        pricing=["Monthly retainer: $6,000", "Unused hours do not roll over unless agreed in writing"],
        risks=["Unclear priorities can reduce retainer efficiency.", "Urgent requests may displace planned roadmap items."],
        next_steps=["Approve retainer scope", "Confirm first-month priorities", "Schedule recurring review call"],
        version_count=3,
        final=True,
    ),
]


class Command(BaseCommand):
    help = "Seed polished demo proposal data for local screenshots."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Delete previous demo records for the target user first.")
        parser.add_argument("--email", default=DEMO_EMAIL, help=f"Target account email. Defaults to {DEMO_EMAIL}.")

    @transaction.atomic
    def handle(self, *args, **options):
        email = str(options["email"]).strip().lower()
        reset = bool(options["reset"])
        user, created = self._get_or_create_demo_user(email)

        if reset:
            self._reset_demo_records(user)
            self.stdout.write(self.style.WARNING(f"Reset previous demo projects for {email}."))

        self._seed_account_state(user)
        projects = [self._upsert_project(user, project_data) for project_data in DEMO_PROJECTS]
        self._seed_ai_usage_logs(user, projects)
        self._seed_quality_reviews(user, projects)

        account_note = "created" if created else "reused"
        self.stdout.write(self.style.SUCCESS(f"Demo data seeded for {email} ({account_note} local user)."))
        self.stdout.write("Created/updated 10 projects, proposal versions, Pro usage state, AI logs, and quality reviews.")
        self.stdout.write(
            "Note: Templates and the Activity page are frontend localStorage-backed in this project, so this command does not persist them."
        )

    def _get_or_create_demo_user(self, email: str):
        UserModel = get_user_model()
        user = UserModel.objects.filter(email__iexact=email).order_by("id").first()
        created = False

        if user is None:
            username_slug = email.split("@", 1)[0].replace(".", "-").replace("_", "-")
            username = f"{DEMO_USERNAME_PREFIX}{username_slug}"[:150]
            user, created = UserModel.objects.get_or_create(
                username=username,
                defaults={
                    "email": email,
                    "first_name": DEMO_FIRST_NAME,
                    "last_name": DEMO_LAST_NAME,
                },
            )

        changed_fields = []
        if user.email.lower() != email:
            user.email = email
            changed_fields.append("email")
        if not user.first_name:
            user.first_name = DEMO_FIRST_NAME
            changed_fields.append("first_name")
        if not user.last_name:
            user.last_name = DEMO_LAST_NAME
            changed_fields.append("last_name")
        if created:
            user.set_unusable_password()
            changed_fields.append("password")
        if changed_fields:
            user.save(update_fields=list(dict.fromkeys(changed_fields)))

        return user, created

    def _reset_demo_records(self, user):
        # Local/demo safety: only delete known demo project names for this user_id, never all user projects.
        demo_names = [project.project_name for project in DEMO_PROJECTS]
        demo_projects = ProposalProject.objects.filter(user_id=user.get_username(), project_name__in=demo_names)

        AIUsageLog.objects.filter(user=user, project__in=demo_projects).delete()
        AIQualityReview.objects.filter(user=user, project__in=demo_projects).delete()
        deleted_count = demo_projects.count()
        demo_projects.delete()

        if user.username.startswith(DEMO_USERNAME_PREFIX):
            UsageRecord.objects.filter(user=user, period=AIUsageService.current_period()).delete()
            UserPlan.objects.filter(user=user).delete()

        self.stdout.write(f"Deleted {deleted_count} known demo projects.")

    def _seed_account_state(self, user):
        user_plan, _created = UserPlan.objects.get_or_create(user=user)
        user_plan.plan = UserPlan.PLAN_PRO
        user_plan.save(update_fields=["plan", "updated_at"])

        usage, _created = UsageRecord.objects.get_or_create(user=user, period=AIUsageService.current_period())
        usage.ai_generations_used = 18
        usage.save(update_fields=["ai_generations_used", "updated_at"])

    def _upsert_project(self, user, data: DemoProject):
        now = timezone.now()
        created_at = now - timedelta(days=data.days_ago_created)
        updated_at = now - timedelta(days=data.days_ago_updated)
        fields = self._project_fields(data)

        project, _created = ProposalProject.objects.update_or_create(
            user_id=user.get_username(),
            project_name=data.project_name,
            defaults=fields,
        )
        ProposalProject.objects.filter(pk=project.pk).update(created_at=created_at, updated_at=updated_at)
        project.refresh_from_db()

        project.versions.all().delete()
        versions = self._create_versions(project, data, created_at, updated_at)
        project.current_version = versions[-1]
        project.save(update_fields=["current_version", "updated_at"])
        ProposalProject.objects.filter(pk=project.pk).update(updated_at=updated_at)
        project.refresh_from_db()
        return project

    def _project_fields(self, data: DemoProject):
        return {
            "client_name": data.client_name,
            "project_type": data.project_type,
            "budget": data.budget,
            "timeline": data.timeline,
            "requirements": self._requirements_for(data),
            "summary": data.summary,
            "scope": self._bullets(data.scope),
            "deliverables": self._bullets(data.deliverables),
            "milestones": "\n".join(data.milestones),
            "proposal_timeline": self._bullets(data.proposal_timeline),
            "pricing": self._bullets(data.pricing),
            "risks": self._bullets(data.risks),
            "next_steps": self._bullets(data.next_steps),
            "missing_information": ["Final stakeholder approver", "Confirmed launch window"] if data.status == "draft" else [],
            "scope_risks": data.risks[:2],
            "unclear_requirements": ["Exact third-party tool access"] if data.status != "completed" else [],
            "suggested_questions": [
                "Who will approve final scope?",
                "Which workflows are highest priority for launch?",
                "Are there any fixed dates we need to protect?",
            ],
            "generated_proposal": self._generated_snapshot(data),
            "status": data.status,
        }

    def _create_versions(self, project, data: DemoProject, created_at, updated_at):
        labels = ["Initial Draft", "Scope Improved", "Final Client Version"][: data.version_count]
        versions = []
        for index, label in enumerate(labels, start=1):
            is_final = data.final and index == len(labels)
            version = ProposalVersion.objects.create(
                project=project,
                version_number=index,
                label=label,
                source="final" if is_final else ("regenerate" if index > 1 else "generate"),
                changed_sections=self._changed_sections(index),
                summary=data.summary if index > 1 else f"{data.summary} This first draft establishes the core client direction.",
                scope=self._bullets(data.scope),
                deliverables=self._bullets(data.deliverables),
                milestones="\n".join(data.milestones),
                proposal_timeline=self._bullets(data.proposal_timeline),
                pricing=self._bullets(data.pricing),
                risks=self._bullets(data.risks),
                next_steps=self._bullets(data.next_steps),
                is_final=is_final,
            )
            version_created_at = created_at + ((updated_at - created_at) * index / max(data.version_count, 1))
            ProposalVersion.objects.filter(pk=version.pk).update(created_at=version_created_at)
            version.refresh_from_db()
            versions.append(version)
        return versions

    def _seed_ai_usage_logs(self, user, projects):
        AIUsageLog.objects.filter(user=user, project__in=projects).delete()
        actions = [
            AIUsageLog.ACTION_FULL_PROPOSAL,
            AIUsageLog.ACTION_SECTION_REGENERATION,
            AIUsageLog.ACTION_QUALITY_SCORE,
            AIUsageLog.ACTION_EDIT_SUGGESTIONS,
        ]
        now = timezone.now()
        for index, project in enumerate(projects[:8]):
            log = AIUsageLog.objects.create(
                user=user,
                project=project,
                action_type=actions[index % len(actions)],
                status=AIUsageLog.STATUS_SUCCESS,
                input_tokens=950 + index * 80,
                output_tokens=520 + index * 45,
                total_tokens=1470 + index * 125,
            )
            AIUsageLog.objects.filter(pk=log.pk).update(created_at=now - timedelta(days=index, hours=2 * index))

    def _seed_quality_reviews(self, user, projects):
        AIQualityReview.objects.filter(user=user, project__in=projects).delete()
        now = timezone.now()
        review_projects = [project for project in projects if project.status in {"in_review", "completed"}][:4]
        for index, project in enumerate(review_projects):
            review = AIQualityReview.objects.create(
                project=project,
                user=user,
                proposal_version=project.current_version,
                score=[88, 91, 84, 89][index],
                summary="The proposal is client-ready with a clear scope, practical delivery structure, and strong commercial framing.",
                strengths=[
                    "Clear project scope",
                    "Professional client-facing tone",
                    "Strong timeline and milestone structure",
                ],
                weaknesses=[
                    "Pricing could be easier to scan",
                    "Deliverables could include more measurable outcomes",
                ],
                recommendations=[
                    "Add success metrics",
                    "Clarify revision limits",
                    "Make pricing assumptions more explicit",
                ],
            )
            AIQualityReview.objects.filter(pk=review.pk).update(created_at=now - timedelta(days=index + 1, hours=3))

    def _requirements_for(self, data: DemoProject) -> str:
        return "\n".join(
            [
                f"Client goal: {data.summary}",
                f"Budget: {data.budget}",
                f"Timeline: {data.timeline}",
                "Primary requirements:",
                *[f"- {item}" for item in data.scope[:3]],
            ]
        )

    def _generated_snapshot(self, data: DemoProject) -> dict:
        return {
            "summary": data.summary,
            "scope_of_work": data.scope,
            "deliverables": data.deliverables,
            "milestones": [
                {
                    "title": milestone.split(":", 1)[0].strip(),
                    "description": milestone.split(":", 1)[1].strip() if ":" in milestone else milestone,
                }
                for milestone in data.milestones
            ],
            "timeline": data.proposal_timeline,
            "pricing": data.pricing,
            "risks": data.risks,
            "next_steps": data.next_steps,
        }

    def _changed_sections(self, version_number: int) -> list[str]:
        if version_number == 1:
            return ["summary", "scope", "deliverables", "milestones", "risks"]
        if version_number == 2:
            return ["scope", "pricing", "next_steps"]
        return ["summary", "pricing", "risks", "next_steps"]

    def _bullets(self, items: list[str]) -> str:
        return "\n".join(f"- {item}" for item in items)
