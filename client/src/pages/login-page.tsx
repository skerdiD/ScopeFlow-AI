import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/demo";

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      setErrorMessage(error);
      toast.error(error);
      setLoading(false);
      return;
    }

    toast.success("Welcome back.");
    navigate(from, { replace: true });
  }

  async function handleDemoSignIn() {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setErrorMessage("");
    setDemoLoading(true);

    const { error } = await signIn(DEMO_EMAIL, DEMO_PASSWORD);
    if (error) {
      const normalizedError = error.toLowerCase();
      const message = normalizedError.includes("email not confirmed")
        ? "The demo account exists, but its email must be confirmed in Supabase Auth before visitors can sign in."
        : normalizedError.includes("invalid login credentials")
          ? "The demo account is not provisioned in Supabase Auth yet. Create or reset demo@scopeflow.ai, then try again."
          : error;
      setErrorMessage(message);
      toast.error(message);
      setDemoLoading(false);
      return;
    }

    toast.success("Welcome to the demo workspace.");
    navigate(from, { replace: true });
  }

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" className="h-9 px-2 text-muted-foreground hover:text-foreground">
        <Link to="/">
          <ArrowLeft className="size-4" />
          Back to Home
        </Link>
      </Button>

      <Card className="border-border/80 bg-card/95 shadow-xl backdrop-blur">
        <CardHeader className="space-y-5">
          <BrandMark className="mx-auto size-14 rounded-2xl" />
          <div className="space-y-2 text-center">
            <CardTitle className="text-3xl">Welcome back</CardTitle>
            <CardDescription className="text-base">
              Login to your ScopeFlow AI workspace
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Button className="w-full" size="lg" type="button" variant="outline" onClick={handleDemoSignIn} disabled={loading || demoLoading}>
              <FlaskConical className="size-4" />
              {demoLoading ? "Opening Demo..." : "Continue as Demo User"}
            </Button>
            <p className="text-center text-xs leading-5 text-muted-foreground">
              Explore the app with sample projects, proposal versions, templates, usage data, and activity history.
            </p>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="login-email">Email</label>
              <Input
                id="login-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="login-password">Password</label>
              <Input
                id="login-password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            {errorMessage ? (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {errorMessage}
              </div>
            ) : null}

            <Button className="w-full" size="lg" type="submit" disabled={loading || demoLoading}>
              {loading ? "Signing in..." : "Sign In"}
              {!loading ? <ArrowRight className="size-4" /> : null}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link className="font-semibold text-primary" to="/signup">
              Create one
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
