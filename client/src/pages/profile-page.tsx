import { Mail, UserCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

export function ProfilePage() {
  const { user } = useAuth();
  const displayName = user?.user_metadata?.full_name || user?.email || "ScopeFlow user";
  const email = user?.email || "No email available";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold">Profile</h1>
        <Badge variant="outline">Account</Badge>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCircle className="size-5 text-primary" />
            Account Details
          </CardTitle>
          <CardDescription>
            Basic profile information from your authenticated session.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Name</p>
            <p className="mt-1 font-medium">{displayName}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Email</p>
            <p className="mt-1 flex items-center gap-2 text-muted-foreground">
              <Mail className="size-4" />
              {email}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
