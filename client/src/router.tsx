import { Navigate, createBrowserRouter } from "react-router-dom";
import { AuthLayout } from "@/components/layout/auth-layout";
import { AppLayout } from "@/components/layout/app-layout";
import { HomePage } from "@/pages/home-page";
import { LoginPage } from "@/pages/login-page";
import { SignupPage } from "@/pages/signup-page";
import { DashboardPage } from "@/pages/dashboard-page";
import { NewProjectPage } from "@/pages/new-project-page";
import { ProjectDetailsPage } from "@/pages/project-details-page";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { GuestRoute } from "@/components/auth/guest-route";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />
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
        element: <LoginPage />
      },
      {
        path: "/signup",
        element: <SignupPage />
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
        element: <DashboardPage />
      },
      {
        path: "/projects",
        element: <Navigate to="/dashboard" replace />
      },
      {
        path: "/projects/new",
        element: <NewProjectPage />
      },
      {
        path: "/projects/:id",
        element: <ProjectDetailsPage />
      }
    ]
  }
]);
