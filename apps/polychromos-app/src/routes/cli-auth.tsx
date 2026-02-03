import { createFileRoute } from "@tanstack/react-router";
import { useAuth, useClerk, useSignIn } from "@clerk/clerk-react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";

export const Route = createFileRoute("/cli-auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: (search.code as string) || "",
  }),
  component: CLIAuthPage,
});

type PageStatus = "loading" | "sign-in" | "completing" | "success" | "error" | "invalid";

function CLIAuthPage() {
  const { code } = Route.useSearch();
  const { isSignedIn, isLoaded } = useAuth();
  const { session } = useClerk();
  const { signIn, setActive } = useSignIn();
  const completeSession = useMutation(api.cliAuth.completeSession);

  const [status, setStatus] = useState<PageStatus>("loading");
  const [error, setError] = useState("");

  // Sign-in form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formStep, setFormStep] = useState<"email" | "password">("email");
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    if (!code) {
      setStatus("invalid");
      return;
    }

    if (!isLoaded) {
      setStatus("loading");
      return;
    }

    if (!isSignedIn) {
      setStatus("sign-in");
      return;
    }

    // User is signed in, complete the CLI auth session
    setStatus("completing");

    const completeAuth = async () => {
      try {
        // Get the Convex token
        const token = await session?.getToken({ template: "polychromos-cli" });

        if (!token) {
          throw new Error("Failed to get authentication token");
        }

        // Calculate expiry (30 days from now)
        const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;

        await completeSession({
          code,
          token,
          expiresAt,
        });

        setStatus("success");
      } catch (err) {
        console.error("CLI auth error:", err);
        setError(err instanceof Error ? err.message : "Authentication failed");
        setStatus("error");
      }
    };

    void completeAuth();
  }, [code, isSignedIn, isLoaded, session, completeSession]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFormLoading(true);

    try {
      const result = await signIn?.create({ identifier: email });
      if (result?.status === "needs_first_factor") {
        setFormStep("password");
      }
    } catch (err: unknown) {
      const message = (err as { errors?: { message?: string }[] }).errors?.[0]?.message ?? "Invalid email";
      setError(message);
    } finally {
      setFormLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFormLoading(true);

    try {
      const result = await signIn?.attemptFirstFactor({
        strategy: "password",
        password,
      });

      if (result?.status === "complete" && result.createdSessionId) {
        await setActive?.({ session: result.createdSessionId });
        // The useEffect will handle completing the CLI auth
      }
    } catch (err: unknown) {
      const message = (err as { errors?: { message?: string }[] }).errors?.[0]?.message ?? "Invalid password";
      setError(message);
    } finally {
      setFormLoading(false);
    }
  };

  // Invalid - no code provided
  if (status === "invalid") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6">
            <div className="text-destructive text-5xl mb-4">⚠</div>
            <CardTitle className="text-destructive mb-2">Invalid Request</CardTitle>
            <p className="text-muted-foreground">
              Missing authentication code. Run <code className="bg-muted px-1 rounded">polychromos login</code> from your terminal.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Sign-in form
  if (status === "sign-in") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Polychromos CLI Login</CardTitle>
            <CardDescription>
              Sign in to authenticate the CLI
            </CardDescription>
          </CardHeader>
          <CardContent>
            {formStep === "email" ? (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={formLoading}
                    autoFocus
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={formLoading}>
                  {formLoading ? "Loading..." : "Continue"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={formLoading}
                    autoFocus
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setFormStep("email")}>
                    Back
                  </Button>
                  <Button type="submit" className="flex-1" disabled={formLoading}>
                    {formLoading ? "Signing in..." : "Sign in"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Completing auth
  if (status === "completing") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-muted-foreground">Completing authentication...</p>
        </div>
      </div>
    );
  }

  // Success
  if (status === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6">
            <div className="text-green-500 text-5xl mb-4">✓</div>
            <CardTitle className="mb-2">CLI Authenticated</CardTitle>
            <p className="text-muted-foreground">
              You can close this window and return to your terminal.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-6">
          <div className="text-destructive text-5xl mb-4">✗</div>
          <CardTitle className="text-destructive mb-2">Authentication Failed</CardTitle>
          <p className="text-muted-foreground mb-4">{error}</p>
          <p className="text-sm text-muted-foreground">
            Try running <code className="bg-muted px-1 rounded">polychromos login</code> again.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
