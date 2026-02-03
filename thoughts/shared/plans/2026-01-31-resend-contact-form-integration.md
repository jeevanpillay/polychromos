# Resend Contact Form Integration - Implementation Plan

## Overview

Integrate Resend email service with the existing contact form dialog to enable email notifications when users submit the contact form. Since you already have a Resend subscription, we'll leverage the Resend SDK with TanStack Start's server functions.

## Current State Analysis

### Existing Implementation
- **Contact Form**: `apps/www/src/components/contact-dialog.tsx`
  - Uses Zod schema for validation (name, email, company, message)
  - Uses React Hook Form with `@polychromos/ui` form components
  - Currently has placeholder `onSubmit` that only logs to console (line 49-52)

- **Environment Setup**: `apps/www/src/env.ts`
  - Uses `@t3-oss/env-core` for type-safe environment variables
  - Currently only validates `VITE_APP_URL` and `NODE_ENV`
  - No server-side environment variables configured

- **Server Functions**: No existing server functions using `createServerFn`
  - Only `loader()` pattern used in `sitemap[.]xml.tsx`

- **Toast Notifications**: `@polychromos/ui` has toast components but not wired up in root layout

### Key Discoveries
- TanStack Start uses `createServerFn({ method: 'POST' })` for server-side form handling
- Server functions can use `.validator()` with Zod schemas for type-safe validation
- No Resend SDK currently installed
- Toast/Sonner component exists but requires `next-themes` (may need adjustment)

## Desired End State

After implementation:
1. Contact form submissions send an email to your inbox via Resend
2. User sees success/error feedback via toast notifications
3. Form resets and dialog closes on successful submission
4. Server-side validation ensures data integrity
5. Environment variables are properly typed and validated

### Verification
- Submit test form and receive email in your Resend-configured inbox
- Verify error handling with invalid data
- Confirm toast notifications appear for success/failure states

## What We're NOT Doing

- Custom email templates (using plain text for simplicity)
- Email confirmation to the submitter
- Rate limiting or spam protection (can add later)
- Database storage of submissions
- Admin dashboard for viewing submissions

## Implementation Approach

We'll create a minimal, clean integration using:
1. TanStack Start `createServerFn` for the server action
2. Resend SDK for email delivery
3. Existing Zod schema for validation
4. Simple toast notifications for user feedback

---

## Phase 1: Install Dependencies & Configure Environment

### Overview
Install Resend SDK and configure environment variables for secure API key handling.

### Changes Required

#### 1. Install Resend SDK
**Command**: Run in monorepo root

```bash
pnpm add resend -F @polychromos/www
```

#### 2. Update Environment Configuration
**File**: `apps/www/src/env.ts`

Add server-side environment variable for Resend API key:

```typescript
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const appUrl =
  process.env.VITE_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
  "http://localhost:3000";

export const env = createEnv({
  clientPrefix: "VITE_",
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  server: {
    RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),
    CONTACT_EMAIL: z.string().email("CONTACT_EMAIL must be a valid email"),
  },
  client: {
    VITE_APP_URL: z.string().url(),
  },
  runtimeEnv: {
    ...process.env,
    VITE_APP_URL: appUrl,
    NODE_ENV: process.env.NODE_ENV,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    CONTACT_EMAIL: process.env.CONTACT_EMAIL,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
```

#### 3. Add Environment Variables
**File**: `apps/www/.vercel/.env.development.local`

Add (you'll need your actual values):

```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
CONTACT_EMAIL=your-email@example.com
```

### Success Criteria

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint` (pre-existing errors in shadcn components, not from our changes)
- [x] Build succeeds: `pnpm build`

#### Manual Verification:
- [ ] Verify environment variables are loaded in development (`pnpm dev:www`)

---

## Phase 2: Create Server Function for Email Sending

### Overview
Create a TanStack Start server function that handles form submission and sends emails via Resend.

### Changes Required

#### 1. Create Contact Form Server Function
**File**: `apps/www/src/functions/contact.ts` (new file)

```typescript
import { createServerFn } from "@tanstack/react-start";
import { Resend } from "resend";
import { z } from "zod";

import { env } from "~/env";

// Reuse the same schema as the client for consistency
export const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email"),
  company: z.string().optional(),
  message: z.string().min(1, "Message is required"),
});

export type ContactFormData = z.infer<typeof contactSchema>;

const resend = new Resend(env.RESEND_API_KEY);

export const sendContactEmail = createServerFn({ method: "POST" })
  .validator(contactSchema)
  .handler(async ({ data }) => {
    const { name, email, company, message } = data;

    const { error } = await resend.emails.send({
      from: "Contact Form <onboarding@resend.dev>", // Use your verified domain in production
      to: [env.CONTACT_EMAIL],
      replyTo: email,
      subject: `New contact from ${name}${company ? ` (${company})` : ""}`,
      text: `
Name: ${name}
Email: ${email}
Company: ${company || "Not provided"}

Message:
${message}

---
Sent from your website contact form
      `.trim(),
    });

    if (error) {
      console.error("Failed to send contact email:", error);
      throw new Error("Failed to send email. Please try again.");
    }

    return { success: true };
  });
```

**Note on `from` address**:
- For development/testing, use `onboarding@resend.dev`
- For production, verify your domain in Resend dashboard and use `contact@yourdomain.com`

### Success Criteria

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] No lint errors: `pnpm lint` (pre-existing errors only)

#### Manual Verification:
- [ ] Server function compiles without errors during dev server startup

**Implementation Note**: After completing this phase and automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 3: Integrate Server Function with Contact Dialog

### Overview
Update the contact dialog component to call the server function and display feedback.

### Changes Required

#### 1. Update Contact Dialog
**File**: `apps/www/src/components/contact-dialog.tsx`

```typescript
import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { z } from "zod";

import { Lissajous } from "@polychromos/ui/components/lissajous";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
  DialogPortal,
  DialogOverlay,
} from "@polychromos/ui/components/ui/dialog";
import { Input } from "@polychromos/ui/components/ui/input";
import { Textarea } from "@polychromos/ui/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "@polychromos/ui/components/ui/form";

import { sendContactEmail } from "~/functions/contact";

const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email"),
  company: z.string().optional(),
  message: z.string().min(1, "Message is required"),
});

interface ContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactDialog({ open, onOpenChange }: ContactDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");

  const form = useForm({
    schema: contactSchema,
    defaultValues: {
      name: "",
      email: "",
      company: "",
      message: "",
    },
  });

  async function onSubmit(values: z.infer<typeof contactSchema>) {
    setIsSubmitting(true);
    setSubmitStatus("idle");

    try {
      await sendContactEmail({ data: values });
      setSubmitStatus("success");
      form.reset();
      // Close dialog after brief delay to show success
      setTimeout(() => {
        onOpenChange(false);
        setSubmitStatus("idle");
      }, 1500);
    } catch (error) {
      console.error("Contact form error:", error);
      setSubmitStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/40" />
        <DialogContent
          hideCloseButton
          className="fixed !left-auto !top-auto !translate-x-0 !translate-y-0 bottom-4 right-4 md:bottom-8 md:right-8 w-[calc(100vw-4rem)] max-w-[1200px] h-[calc(100vh-4rem)] max-h-[800px] bg-dialog-light text-dialog-light-foreground border-0 !rounded-xs p-6 md:p-10 flex flex-col data-[state=open]:!slide-in-from-right-full data-[state=open]:!slide-in-from-top-0 data-[state=closed]:!slide-out-to-right-full data-[state=closed]:!slide-out-to-top-0 data-[state=closed]:!zoom-out-100 data-[state=open]:!zoom-in-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-5 border-b border-dialog-light-border">
            <DialogTitle
              className="text-2xl md:text-3xl text-dialog-light-foreground"
              style={{ fontFamily: "Joyride, sans-serif" }}
            >
              JEEVAN{" "}
              <span style={{ fontFamily: "JoyrideALT, sans-serif" }}>P</span>
              <span style={{ fontFamily: "JoyrideALT, sans-serif" }}>I</span>
              LLAY
            </DialogTitle>
            <DialogClose className="text-base font-medium text-dialog-light-foreground hover:opacity-60 transition-opacity">
              Close
            </DialogClose>
          </div>

          {/* Grid: Quote + Form */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-12 pt-10">
            {/* Left: Lissajous Art */}
            <div className="flex flex-col col-span-1">
              <div className="border border-dialog-light-border overflow-hidden w-24 h-24">
                <Lissajous
                  a={3}
                  b={4}
                  stroke="var(--dialog-light-border)"
                  strokeWidth={0.8}
                  className="w-full h-full"
                />
              </div>
            </div>

            {/* Right: Form */}
            <div className="flex flex-col col-span-1 md:col-span-2">
              <h2 className="text-3xl md:text-4xl font-semibold leading-tight mb-8 text-dialog-light-foreground">
                Let's connect.
              </h2>

              {/* Success Message */}
              {submitStatus === "success" && (
                <div className="mb-6 p-4 border border-dialog-light-border bg-dialog-light-border/10 text-dialog-light-foreground">
                  <p className="font-medium">Message sent successfully!</p>
                  <p className="text-sm text-dialog-light-muted mt-1">
                    I'll get back to you soon.
                  </p>
                </div>
              )}

              {/* Error Message */}
              {submitStatus === "error" && (
                <div className="mb-6 p-4 border border-destructive bg-destructive/10 text-destructive">
                  <p className="font-medium">Failed to send message</p>
                  <p className="text-sm mt-1">
                    Please try again or email me directly.
                  </p>
                </div>
              )}

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col space-y-5">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-dialog-light-foreground">
                          <span className="text-dialog-light-muted">(01)</span> Name{" "}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Your name"
                            disabled={isSubmitting}
                            className="border-0 border-b border-dialog-light-border rounded-none bg-transparent px-0 shadow-none text-dialog-light-foreground placeholder:text-dialog-light-muted focus-visible:ring-0 focus-visible:border-dialog-light-foreground disabled:opacity-50"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-dialog-light-foreground">
                          <span className="text-dialog-light-muted">(02)</span> Email{" "}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="your@email.com"
                            disabled={isSubmitting}
                            className="border-0 border-b border-dialog-light-border rounded-none bg-transparent px-0 shadow-none text-dialog-light-foreground placeholder:text-dialog-light-muted focus-visible:ring-0 focus-visible:border-dialog-light-foreground disabled:opacity-50"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="company"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-dialog-light-foreground">
                          <span className="text-dialog-light-muted">(03)</span> Company{" "}
                          <span className="text-dialog-light-muted">(Optional)</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Your company"
                            disabled={isSubmitting}
                            className="border-0 border-b border-dialog-light-border rounded-none bg-transparent px-0 shadow-none text-dialog-light-foreground placeholder:text-dialog-light-muted focus-visible:ring-0 focus-visible:border-dialog-light-foreground disabled:opacity-50"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem className="flex-1 flex flex-col">
                        <FormLabel className="text-sm font-medium text-dialog-light-foreground">
                          <span className="text-dialog-light-muted">(04)</span> Message{" "}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Tell me about your project..."
                            disabled={isSubmitting}
                            className="flex-1 min-h-[60px] border-0 border-b border-dialog-light-border rounded-none bg-transparent px-0 shadow-none resize-none text-dialog-light-foreground placeholder:text-dialog-light-muted focus-visible:ring-0 focus-visible:border-dialog-light-foreground disabled:opacity-50"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Footer: Submit */}
                  <div className="pt-6 flex justify-center">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-3 text-xl font-medium text-dialog-light-foreground border-b-2 border-dialog-light-foreground pb-1 hover:opacity-60 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          Sending
                          <Loader2 className="w-6 h-6 animate-spin" />
                        </>
                      ) : (
                        <>
                          Let's talk
                          <ArrowRight className="w-6 h-6" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </Form>
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
```

### Success Criteria

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint` (pre-existing errors only)
- [x] Build succeeds: `pnpm build`

#### Manual Verification:
- [ ] Open contact dialog in browser
- [ ] Submit form with valid data
- [ ] Verify email arrives in your inbox
- [ ] Verify loading state shows during submission
- [ ] Verify success message displays
- [ ] Verify dialog closes after success
- [ ] Test error handling by temporarily using invalid API key

**Implementation Note**: After completing this phase and automated verification passes, pause for manual email testing before finalizing.

---

## Phase 4: Production Configuration (Optional)

### Overview
Configure verified domain for production email sending.

### Changes Required

#### 1. Verify Domain in Resend
In Resend dashboard:
1. Go to Domains
2. Add your domain
3. Add DNS records as instructed
4. Wait for verification

#### 2. Update From Address
**File**: `apps/www/src/functions/contact.ts`

Change the `from` field:

```typescript
from: "Contact Form <contact@yourdomain.com>", // Your verified domain
```

#### 3. Add Production Environment Variables
In Vercel dashboard or `.env.production`:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
CONTACT_EMAIL=your-email@example.com
```

### Success Criteria

#### Manual Verification:
- [ ] Domain verified in Resend dashboard
- [ ] Production deployment sends emails successfully
- [ ] Emails don't land in spam

---

## Testing Strategy

### Manual Testing Steps
1. **Happy Path**: Fill all fields, submit, verify email received
2. **Validation**: Submit with empty required fields, verify error messages
3. **Loading State**: Submit and verify spinner appears
4. **Success State**: Verify success message and auto-close
5. **Error Handling**: Use invalid API key, verify error message shows
6. **Reply-To**: Reply to received email, verify it goes to submitter's address

### Edge Cases to Test
- Very long message content
- Special characters in name/company
- Email with subdomain
- Rapid form submissions

---

## File Summary

| File | Action | Purpose |
|------|--------|---------|
| `apps/www/package.json` | Modify | Add resend dependency |
| `apps/www/src/env.ts` | Modify | Add server env variables |
| `apps/www/.vercel/.env.development.local` | Modify | Add API keys |
| `apps/www/src/functions/contact.ts` | Create | Server function for email |
| `apps/www/src/components/contact-dialog.tsx` | Modify | Integrate server function |

---

## References

- Research document: `thoughts/shared/research/2026-01-31-web-analysis-contact-form-email-solutions.md`
- TanStack Start Server Functions: https://tanstack.com/start/latest/docs/framework/react/guide/server-functions
- Resend Documentation: https://resend.com/docs
- Current contact dialog: `apps/www/src/components/contact-dialog.tsx`
- Environment config: `apps/www/src/env.ts`

---

**Last Updated**: 2026-01-31
**Confidence Level**: High - Based on existing codebase patterns and official documentation
