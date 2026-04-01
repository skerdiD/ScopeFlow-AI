import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";

export function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error, needsEmailConfirmation } = await signUp(email, password);

    if (error) {
      setErrorMessage(error);
      toast.error(error);
      setLoading(false);
      return;
    }

    if (needsEmailConfirmation) {
      setSuccessMessage("Account created. Check your email to confirm your account, then sign in.");
      toast.success("Account created. Check your email for confirmation.");
      setLoading(false);
      return;
    }

    setSuccessMessage("Account created successfully. Redirecting to login...");
    toast.success("Account created successfully.");
    setLoading(false);
    navigate("/login", { replace: true });
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
            <CardTitle className="text-3xl">Create your account</CardTitle>
            <CardDescription className="text-base">
              Start managing AI proposals with a clean premium workflow
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
                placeholder="Create a password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Confirm password</label>
              <Input
                type="password"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            {errorMessage ? (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {errorMessage}
              </div>
            ) : null}

            {successMessage ? (
              <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
                {successMessage}
              </div>
            ) : null}

            <Button className="w-full" size="lg" type="submit" disabled={loading}>
              {loading ? "Creating account..." : "Create Account"}
              {!loading ? <ArrowRight className="size-4" /> : null}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link className="font-semibold text-primary" to="/login">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
