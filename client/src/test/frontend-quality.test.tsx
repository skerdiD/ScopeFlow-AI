import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

function FrontendQualitySmoke() {
  return (
    <section aria-label="Frontend quality smoke test">
      <h1>ScopeFlow AI</h1>
      <p>Frontend tests render without external services.</p>
    </section>
  );
}

describe("frontend quality setup", () => {
  it("renders a React component in jsdom", () => {
    render(<FrontendQualitySmoke />);

    expect(
      screen.getByRole("heading", { name: /scopeflow ai/i })
    ).toBeInTheDocument();

    expect(
      screen.getByText(/frontend tests render without external services/i)
    ).toBeInTheDocument();
  });

  it("merges Tailwind utility classes with the cn helper", () => {
    const shouldHide = false;

    expect(cn("px-2", shouldHide && "hidden", "px-4", "text-sm")).toBe(
      "px-4 text-sm"
    );
  });
});
