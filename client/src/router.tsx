import { Suspense, lazy, type ReactNode } from "react";
import { createBrowserRouter } from "react-router-dom";
import { AuthLayout } from "@/components/layout/auth-layout";
import { AppLayout } from "@/components/layout/app-layout";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { GuestRoute } from "@/components/auth/guest-route";

const HomePage = lazy(async () => ({ default: (await import("@/pages/home-page")).HomePage }));
const LoginPage = lazy(async () => ({ default: (await import("@/pages/login-page")).LoginPage }));
const SignupPage = lazy(async () => ({ default: (await import("@/pages/signup-page")).SignupPage }));
const DashboardPage = lazy(async () => ({ default: (await import("@/pages/dashboard-page")).DashboardPage }));
const NewProjectPage = lazy(async () => ({ default: (await import("@/pages/new-project-page")).NewProjectPage }));
const NewTemplatePage = lazy(async () => ({ default: (await import("@/pages/new-template-page")).NewTemplatePage }));
const EditTemplatePage = lazy(async () => ({ default: (await import("@/pages/edit-template-page")).EditTemplatePage }));
const ProjectDetailsPage = lazy(async () => ({ default: (await import("@/pages/project-details-page")).ProjectDetailsPage }));
const TemplatesPage = lazy(async () => ({ default: (await import("@/pages/templates-page")).TemplatesPage }));
const ActivityPage = lazy(async () => ({ default: (await import("@/pages/activity-page")).ActivityPage }));
const SettingsPage = lazy(async () => ({ default: (await import("@/pages/settings-page")).SettingsPage }));

function withPageLoader(element: ReactNode) {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading...</div>}>
      {element}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: withPageLoader(<HomePage />)
  },
  {
    element: (
      <GuestRoute>
        <AuthLayout />
      </GuestRoute>
    ),
    children: [
      {
        path: "/login",
        element: withPageLoader(<LoginPage />)
      },
      {
        path: "/signup",
        element: withPageLoader(<SignupPage />)
      }
    ]
  },
  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: "/dashboard",
        element: withPageLoader(<DashboardPage />)
      },
      {
        path: "/projects",
        element: withPageLoader(<DashboardPage />)
      },
      {
        path: "/projects/new",
        element: withPageLoader(<NewProjectPage />)
      },
      {
        path: "/templates",
        element: withPageLoader(<TemplatesPage />)
      },
      {
        path: "/templates/new",
        element: withPageLoader(<NewTemplatePage />)
      },
      {
        path: "/templates/:templateId/edit",
        element: withPageLoader(<EditTemplatePage />)
      },
      {
        path: "/activity",
        element: withPageLoader(<ActivityPage />)
      },
      {
        path: "/settings",
        element: withPageLoader(<SettingsPage />)
      },
      {
        path: "/projects/:id",
        element: withPageLoader(<ProjectDetailsPage />)
      }
    ]
  }
]);
