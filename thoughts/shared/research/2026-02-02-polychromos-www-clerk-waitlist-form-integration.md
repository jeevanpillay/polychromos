---
date: 2026-02-02T12:00:00+11:00
researcher: Claude
git_commit: b90f99c255b27ceb07b2d88e8b71a9fc8aeb34c9
branch: feat/polychromos-mvp-implementation
repository: x
topic: "Clerk Waitlist Integration with Form Pattern for polychromos-www"
tags: [research, codebase, clerk, waitlist, form, react-hook-form, zod, server-functions, tanstack-start]
status: complete
last_updated: 2026-02-02
last_updated_by: Claude
---

# Research: Clerk Waitlist Integration with Form Pattern for polychromos-www

**Date**: 2026-02-02T12:00:00+11:00
**Researcher**: Claude
**Git Commit**: b90f99c255b27ceb07b2d88e8b71a9fc8aeb34c9
**Branch**: feat/polychromos-mvp-implementation
**Repository**: x

## Research Question

How to upgrade `apps/polychromos-www/src/routes/index.tsx` to use Clerk waitlist when saving with the full `@polychromos/ui/components/ui/form.tsx` pattern, using the server function approach.

## Summary

This document details the existing patterns in the codebase for implementing a Clerk waitlist integration with react-hook-form + Zod validation using TanStack Start server functions. The codebase has one complete reference implementation in `apps/www` that demonstrates all required patterns.

## Detailed Findings

### Current State of polychromos-www/routes/index.tsx

The current implementation has a basic email input form without validation or submission logic:

**Location**: `apps/polychromos-www/src/routes/index.tsx:54-63`

```tsx
<div className="flex gap-2">
  <Input
    type="email"
    placeholder="Enter your email"
    className="max-w-xs rounded-none"
  />
  <Button size="default" className="rounded-none">
    <span className="mr-1">↗</span> Join
  </Button>
</div>
```

Key observations:
- No form validation
- No submission handler
- No server function connection
- Uses `@polychromos/ui` Input and Button components

### Pattern 1: Server Function Definition

**Reference**: `apps/www/src/functions/contact.ts:7-47`

```typescript
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Schema definition (exported for client-side use)
export const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email"),
  company: z.string().optional(),
  message: z.string().min(1, "Message is required"),
});

export type ContactFormData = z.infer<typeof contactSchema>;

// Server function with input validation
export const sendContactEmail = createServerFn({ method: "POST" })
  .inputValidator((data: ContactFormData) => contactSchema.parse(data))
  .handler(async ({ data }) => {
    // Server-side logic here
    const { error } = await resend.emails.send({...});

    if (error) {
      throw new Error("Failed to send email. Please try again.");
    }

    return { success: true };
  });
```

Key aspects:
- Uses `createServerFn({ method: "POST" })`
- Chains `.inputValidator()` with Zod schema `.parse()`
- Chains `.handler()` for async server logic
- Returns success object or throws error
- Exports schema and type for client use

### Pattern 2: Form Component with useForm Hook

**Reference**: `apps/www/src/components/contact-dialog.tsx:29-75`

```typescript
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "@polychromos/ui/components/ui/form";

// Local schema (can also import from server function file)
const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email"),
});

// Inside component:
const [isSubmitting, setIsSubmitting] = useState(false);
const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");

const form = useForm({
  schema: contactSchema,
  defaultValues: {
    email: "",
  },
});

async function onSubmit(values: z.infer<typeof contactSchema>) {
  setIsSubmitting(true);
  setSubmitStatus("idle");

  try {
    await serverFunction({ data: values });
    setSubmitStatus("success");
    form.reset();
  } catch (error) {
    console.error("Form error:", error);
    setSubmitStatus("error");
  } finally {
    setIsSubmitting(false);
  }
}
```

Key aspects:
- Custom `useForm` hook from `@polychromos/ui` automatically configures zodResolver
- Manual state management for `isSubmitting` and `submitStatus`
- Server function called with `{ data: values }` object structure
- Uses `z.infer<typeof schema>` for type safety

### Pattern 3: Form JSX Structure

**Reference**: `apps/www/src/components/contact-dialog.tsx:142-261`

```tsx
<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
    <FormField
      control={form.control}
      name="email"
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            Email <span className="text-destructive">*</span>
          </FormLabel>
          <FormControl>
            <Input
              placeholder="you@example.com"
              disabled={isSubmitting}
              {...field}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />

    <Button type="submit" disabled={isSubmitting}>
      {isSubmitting ? (
        <>Submitting <Loader2 className="animate-spin" /></>
      ) : (
        <>Join <ArrowRight /></>
      )}
    </Button>
  </form>
</Form>
```

Key aspects:
- Wraps form with `<Form {...form}>` provider
- Uses `form.handleSubmit(onSubmit)` on form element
- `FormField` requires `control`, `name`, and `render` props
- Render prop provides `field` to spread onto inputs
- Structure: `FormField > FormItem > FormLabel + FormControl + FormMessage`
- `FormMessage` automatically displays Zod validation errors

### Pattern 4: Status Feedback UI

**Reference**: `apps/www/src/components/contact-dialog.tsx:123-140`

```tsx
{submitStatus === "success" && (
  <div className="border-border bg-muted text-foreground p-4">
    <p className="font-medium">Successfully joined the waitlist!</p>
    <p className="text-muted-foreground text-sm">We'll be in touch.</p>
  </div>
)}

{submitStatus === "error" && (
  <div className="border-destructive bg-destructive/10 text-destructive p-4">
    <p className="font-medium">Failed to join waitlist</p>
    <p className="text-sm">Please try again.</p>
  </div>
)}
```

### Clerk Waitlist API Details

**Backend API Endpoint**: `https://api.clerk.com/v1/waitlist_entries`

**Request Format**:
```json
{
  "email_address": "user@example.com",
  "notify": true
}
```

**Response**: Returns `WaitlistEntry` object with `id`, `email_address`, `status`, `created_at`, `updated_at`

**Required Environment Variables**:
```bash
CLERK_SECRET_KEY=sk_test_...  # Server-side only
```

**Server-Side Call Example**:
```typescript
// Using REST API directly (recommended for polychromos-www)
const response = await fetch('https://api.clerk.com/v1/waitlist_entries', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${env.CLERK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email_address: data.email,
    notify: true,
  }),
});

if (!response.ok) {
  throw new Error('Failed to join waitlist');
}

return { success: true };
```

### File Organization Pattern

**Recommended structure for polychromos-www**:
```
apps/polychromos-www/src/
├── functions/
│   └── waitlist.ts          # Server function definition
└── routes/
    └── index.tsx            # Page component with form
```

### Environment Configuration

**Current polychromos-www env.ts**: `apps/polychromos-www/src/env.ts`

Needs addition of:
```typescript
server: {
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
},
```

**turbo.json already declares**: `CLERK_SECRET_KEY` in global passthrough (line 65)

## Code References

- `apps/www/src/functions/contact.ts:18-47` - Server function definition pattern
- `apps/www/src/components/contact-dialog.tsx:29-55` - useForm hook setup
- `apps/www/src/components/contact-dialog.tsx:57-75` - Submit handler pattern
- `apps/www/src/components/contact-dialog.tsx:142-261` - Form JSX structure
- `packages/ui/src/components/ui/form.tsx:26-38` - Custom useForm hook implementation
- `packages/ui/src/components/ui/form.tsx:53-192` - Form component definitions
- `apps/polychromos-www/src/routes/index.tsx:54-63` - Current waitlist form (no validation)
- `apps/polychromos-www/src/env.ts:1-32` - Environment configuration

## Architecture Documentation

### Server Function Flow
1. Client calls server function with `{ data: formValues }`
2. Server function validates input using Zod schema
3. Server function executes handler (API call to Clerk)
4. Returns success object or throws error
5. Client handles response in try/catch

### Form Component Architecture
1. `Form` component provides react-hook-form context
2. `FormField` wraps Controller for field registration
3. `FormItem` provides layout and context for accessibility IDs
4. `FormControl` applies ARIA attributes to child input
5. `FormMessage` displays validation errors automatically

### Type Safety Chain
1. Zod schema defines validation rules
2. `z.infer<typeof schema>` extracts TypeScript type
3. useForm hook infers types from schema
4. Server function validates with same schema

## Related Research

- `thoughts/shared/research/2026-02-02-polychromos-clerk-convex-auth-integration.md` - Clerk auth patterns in polychromos-app

## Open Questions

None - all patterns are documented in the existing codebase.
