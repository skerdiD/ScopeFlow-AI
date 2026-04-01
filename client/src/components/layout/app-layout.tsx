import { Outlet } from "react-router-dom";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Topbar } from "@/components/layout/topbar";

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <AppSidebar />
        <div className="flex min-h-screen flex-col">
          <Topbar />
          <main className="flex-1 p-4 pb-24 md:p-6 md:pb-24 lg:p-8 lg:pb-8">
            <div className="mx-auto w-full max-w-7xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <MobileNav />
    </div>
  );
}
