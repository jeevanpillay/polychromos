---
date: 2026-02-02T22:00:00+11:00
author: Claude
git_commit: b90f99c255b27ceb07b2d88e8b71a9fc8aeb34c9
branch: feat/polychromos-mvp-implementation
repository: x
topic: "Polychromos WWW Clerk Waitlist Form Integration"
tags: [plan, implementation, clerk, waitlist, form, react-hook-form, zod, tanstack-start]
status: draft
last_updated: 2026-02-02
last_updated_by: Claude
---

# Polychromos WWW Clerk Waitlist Form Integration

## Overview

Upgrade the waitlist form in `apps/polychromos-www/src/routes/index.tsx` to use Clerk's waitlist API with proper form validation using `react-hook-form` + Zod, following the established patterns from `apps/www`.

## Current State Analysis

**Current Implementation** (`apps/polychromos-www/src/routes/index.tsx:54-63`):
- Basic email input with no validation
- No form submission handler
- No server function connection
- Uses `@repo/ui` Input and Button components

**Reference Implementation** (`apps/www`):
- `apps/www/src/functions/contact.ts` - Server function pattern with Zod validation
- `apps/www/src/components/contact-dialog.tsx` - Full form implementation with `useForm` hook

**Environment**:
- `CLERK_SECRET_KEY` already declared in `turbo.json` globalEnv (line 65)
- `apps/polychromos-www/src/env.ts` currently has no server variables defined

## Desired End State

1. Email waitlist form with Zod validation (valid email required)
2. Server function that calls Clerk Waitlist API
3. Loading state during submission
4. Success/error feedback to user
5. Form reset on successful submission

### Verification Criteria:
- Form shows validation error for invalid emails
- Successful submission adds email to Clerk waitlist
- User sees success message after submission
- Form handles API errors gracefully

## What We're NOT Doing

- Adding additional form fields (name, company, etc.)
- Implementing a dialog-based form (keeping inline)
- Adding email confirmation/double opt-in
- Storing waitlist entries locally

## Implementation Approach

Follow the exact patterns from `apps/www`:
1. Create server function with Zod schema
2. Update env.ts to include `CLERK_SECRET_KEY`
3. Update route component with form logic

## Phase 1: Create Server Function

### Overview
Create the waitlist server function that validates email and calls Clerk API.

### Changes Required:

#### 1. Create Server Function
**File**: `apps/polychromos-www/src/functions/waitlist.ts` (new file)

```typescript
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { env } from "~/env";

export const waitlistSchema = z.object({
  email: z.string().email("Please enter a valid email"),
});

export type WaitlistFormData = z.infer<typeof waitlistSchema>;

export const joinWaitlist = createServerFn({ method: "POST" })
  .inputValidator((data: WaitlistFormData) => waitlistSchema.parse(data))
  .handler(async ({ data }) => {
    const response = await fetch("https://api.clerk.com/v1/waitlist_entries", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CLERK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email_address: data.email,
        notify: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error("Clerk waitlist API error:", error);
      throw new Error("Failed to join waitlist. Please try again.");
    }

    return { success: true };
  });
```

### Success Criteria:

#### Automated Verification:
- [x] File exists at correct path
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] None for this phase (server function tested in Phase 3)

---

## Phase 2: Update Environment Configuration

### Overview
Add `CLERK_SECRET_KEY` to the server environment variables.

### Changes Required:

#### 1. Update Environment Schema
**File**: `apps/polychromos-www/src/env.ts`
**Changes**: Add CLERK_SECRET_KEY to server schema

```typescript
import { createEnv } from "@t3-oss/env-core";
import { vercel } from "@t3-oss/env-core/presets-zod";
import { z } from "zod";

const appUrl =
  process.env.VITE_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
  "http://localhost:3001";

export const env = createEnv({
  extends: [vercel()],
  clientPrefix: "VITE_",
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  server: {
    CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
  },
  client: {
    VITE_APP_URL: z.string().url(),
  },
  runtimeEnv: {
    ...process.env,
    VITE_APP_URL: appUrl,
    NODE_ENV: process.env.NODE_ENV,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  },
  skipValidation:
    !!process.env.CI ||
    process.env.npm_lifecycle_event === "lint" ||
    process.env.npm_lifecycle_event === "build",
  emptyStringAsUndefined: true,
});
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Verify `CLERK_SECRET_KEY` is set in `.env` file (user responsibility)

---

## Phase 3: Update Route Component with Form

### Overview
Transform the static email input into a validated form with submission handling.

### Changes Required:

#### 1. Update Home Page Route
**File**: `apps/polychromos-www/src/routes/index.tsx`
**Changes**: Add form logic with react-hook-form, Zod validation, and status handling

```tsx
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Loader2 } from "lucide-react";
import { z } from "zod";

import { Button } from "@repo/ui/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  useForm,
} from "@repo/ui/components/ui/form";
import { Input } from "@repo/ui/components/ui/input";

import { joinWaitlist, waitlistSchema } from "~/functions/waitlist";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "success" | "error"
  >("idle");

  const form = useForm({
    schema: waitlistSchema,
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(values: z.infer<typeof waitlistSchema>) {
    setIsSubmitting(true);
    setSubmitStatus("idle");

    try {
      await joinWaitlist({ data: values });
      setSubmitStatus("success");
      form.reset();
    } catch (error) {
      console.error("Waitlist form error:", error);
      setSubmitStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="bg-background text-foreground relative flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-6 lg:px-12">
        {/* Left: Logo + Time */}
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className="text-lg"
            style={{ fontFamily: "var(--font-hw-animo-semi-expanded)" }}
          >
            POLYCHROMOS
          </Link>
          <span className="text-muted-foreground font-mono text-xs">
            v0.0.1
          </span>
        </div>

        {/* Right: CTA */}
        <Button size="default" className="rounded-none">
          <span className="mr-1">↗</span> GET EARLY ACCESS
        </Button>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 flex-col px-6 lg:px-12">
        {/* Hero Section */}
        <div className="mt-16 flex-1 lg:mt-24">
          {/* Value Proposition */}
          <div className="flex max-w-xl flex-col">
            <div className="font-pp-neue text-xl leading-relaxed font-medium lg:text-2xl space-y-4">
              <p>
                Bridge the gap between Figma and React. Direct manipulation of
                the DOM with a designer-friendly interface.
              </p>
              <p>Code-first. Real-time. No more handoff friction.</p>
            </div>

            <div className="mt-8 space-y-3">
              <p className="text-muted-foreground text-sm">
                Be the first to experience code-driven design. Join the
                waitlist.
              </p>

              {/* Success Message */}
              {submitStatus === "success" && (
                <div className="border-border bg-muted text-foreground max-w-sm p-3">
                  <p className="text-sm font-medium">
                    You're on the list!
                  </p>
                  <p className="text-muted-foreground text-xs mt-1">
                    We'll notify you when early access is available.
                  </p>
                </div>
              )}

              {/* Error Message */}
              {submitStatus === "error" && (
                <div className="border-destructive bg-destructive/10 text-destructive max-w-sm border p-3">
                  <p className="text-sm font-medium">
                    Something went wrong
                  </p>
                  <p className="text-xs mt-1">
                    Please try again.
                  </p>
                </div>
              )}

              {/* Form */}
              {submitStatus !== "success" && (
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="flex gap-2"
                  >
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem className="flex-1 max-w-xs space-y-1">
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="Enter your email"
                              disabled={isSubmitting}
                              className="rounded-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      size="default"
                      className="rounded-none"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <span className="mr-1">↗</span> Join
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              )}
            </div>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom Large Typography */}
        <div className="mb-8 lg:mb-12">
          <div className="text-primary overflow-hidden">
            <h1 className="text-[10vw] leading-[0.95] tracking-tight lg:text-5xl">
              <span
                style={{ fontFamily: "var(--font-hw-animo-semi-expanded)" }}
              >
                DESIGN IS NO LONGER
              </span>
              <span
                style={{
                  fontFamily: "var(--font-hw-animo-semi-expanded)",
                }}
              >
                {" "}
                STATIC PIXELS.
              </span>
            </h1>
            <h1 className="text-[10vw] leading-[0.95] tracking-tight lg:text-10xl">
              <span
                style={{ fontFamily: "var(--font-hw-animo-semi-expanded)" }}
              >
                IT IS
              </span>
              <span
                style={{
                  fontFamily: "var(--font-hw-animo-semi-condensed-outline)",
                }}
              >
                {" "}
                EXECUTABLE LOGIC.
              </span>
            </h1>
          </div>
        </div>
      </main>
    </div>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [x] Build succeeds: `pnpm build`

#### Manual Verification:
- [ ] Form displays validation error for invalid email (e.g., "test")
- [ ] Form displays validation error for empty submission
- [ ] Loading spinner appears during submission
- [ ] Success message appears after successful submission
- [ ] Form hides after successful submission
- [ ] Error message appears if API call fails
- [ ] Email appears in Clerk dashboard waitlist

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the waitlist integration works end-to-end.

---

## Testing Strategy

### Manual Testing Steps:
1. Navigate to http://localhost:3001
2. Submit empty form - should show "Please enter a valid email"
3. Submit "invalid" - should show "Please enter a valid email"
4. Submit valid email - should show loading, then success message
5. Check Clerk dashboard - email should appear in waitlist
6. Test with CLERK_SECRET_KEY missing - should show error message

## Performance Considerations

- Server function runs on server only (secret key not exposed)
- No additional client-side dependencies added
- Form state managed locally (no global state needed)

## References

- Research document: `thoughts/shared/research/2026-02-02-polychromos-www-clerk-waitlist-form-integration.md`
- Reference implementation: `apps/www/src/functions/contact.ts`
- Reference form: `apps/www/src/components/contact-dialog.tsx`
- Clerk Waitlist API: `https://api.clerk.com/v1/waitlist_entries`
