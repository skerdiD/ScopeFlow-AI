import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UsageCard } from "@/components/billing/usage-card";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    isDemo: true,
  }),
}));

describe("demo usage card", () => {
  it("shows neutral sample usage instead of an upgrade warning", () => {
    render(
      <MemoryRouter>
        <UsageCard
          usage={{
            plan: "pro",
            used: 50,
            limit: 50,
            remaining: 0,
            is_unlimited: false,
            period: "2026-06",
          }}
        />
      </MemoryRouter>
    );

    expect(screen.getByText(/sample usage data is shown/i)).toBeInTheDocument();
    expect(screen.queryByText(/reached your monthly ai generation limit/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /view plans/i })).not.toBeInTheDocument();
  });
});
