import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

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
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Sparkles className="size-6" />
          </div>
          <div className="space-y-2 text-center">
            <CardTitle className="text-3xl">Welcome back</CardTitle>
            <CardDescription className="text-base">
              Login to your ScopeFlow AI workspace
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <Input
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

            <Button className="w-full" size="lg" type="submit" disabled={loading}>
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
