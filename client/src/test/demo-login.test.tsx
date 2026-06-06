import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LoginPage } from "@/pages/login-page";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/demo";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    signIn: vi.fn().mockResolvedValue({ error: null }),
  }),
}));

describe("demo login access", () => {
  it("shows the demo option and signs in with the published credentials", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /continue as demo user/i }));

    expect(screen.getByLabelText(/email/i)).toHaveValue(DEMO_EMAIL);
    expect(screen.getByLabelText(/password/i)).toHaveValue(DEMO_PASSWORD);
    expect(screen.getByText(/sample projects, proposal versions, templates/i)).toBeInTheDocument();
  });
});
