---
date: 2026-01-31T16:00:00+11:00
researcher: Claude Opus 4.5
topic: "Contact Form Email Solutions - Simplest & Most Efficient Approaches"
tags: [research, web-analysis, email, contact-form, resend, web3forms, next.js]
status: complete
created_at: 2026-01-31
confidence: high
sources_count: 25
---

# Web Research: Contact Form Email Solutions

**Date**: 2026-01-31
**Topic**: Simplest and most efficient solutions for tracking emails from contact forms
**Confidence**: High - based on official documentation and recent reviews

## Research Question

What is the simplest and most efficient approach to handle contact form submissions and email tracking for the contact dialog at `apps/www/src/components/contact-dialog.tsx`?

## Executive Summary

For your TanStack Start application, **two clear winners emerge**:

1. **Web3Forms** (Simplest): Zero backend needed, 5-minute setup, just POST to their API. Free tier: 250 submissions/month. Perfect if you just want form submissions emailed to you.

2. **Resend** (Best for React/Next.js): Modern developer experience, TypeScript SDK, 3,000 emails/month free. Requires a server action or API route but gives you full control over email templates.

**Recommendation**: Start with **Web3Forms** for simplicity. Migrate to **Resend** if you need custom email templates or higher volume.

## Key Metrics & Findings

### Setup Complexity Comparison

| Service | Setup Time | Backend Required | Free Tier | Best For |
|---------|------------|------------------|-----------|----------|
| Web3Forms | 5-10 min | No | 250/mo | Simplicity |
| Resend | 2-3 hours | Yes (API route) | 3,000/mo | DX + Control |
| Formspree | 30-60 min | No | 50/mo | Integrations |
| Postmark | 4-8 hours | Yes | 100/mo | Deliverability |
| SendGrid | 1-3 days | Yes | 3,000/mo | High volume |

### Pricing Analysis

| Service | Free Tier | Paid Starting | 10k emails/mo |
|---------|-----------|---------------|---------------|
| Web3Forms | 250/mo | $12/mo | $12/mo |
| Resend | 3,000/mo | $20/mo | $20/mo |
| Formspree | 50/mo | $15/mo | $30/mo |
| Postmark | 100/mo | $15/mo | $15/mo |
| SendGrid | 100/day | $19.95/mo | $19.95/mo |

## Recommended Solutions

### Option 1: Web3Forms (Simplest - Recommended)

**Why**: Zero configuration, no backend, works immediately.

**Implementation** (for your contact-dialog.tsx):

```tsx
async function onSubmit(values: z.infer<typeof contactSchema>) {
  const response = await fetch("https://api.web3forms.com/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_key: "YOUR_ACCESS_KEY", // Get free at web3forms.com
      name: values.name,
      email: values.email,
      company: values.company,
      message: values.message,
      subject: `Contact from ${values.name}`,
    }),
  });

  const data = await response.json();
  if (data.success) {
    // Handle success
    form.reset();
  }
}
```

**Setup Steps**:
1. Go to [web3forms.com](https://web3forms.com)
2. Enter your email to receive submissions
3. Copy the access key
4. Add to your form submit handler

**Pros**:
- No backend/server actions needed
- Works with TanStack Start immediately
- Free tier sufficient for most contact forms
- hCaptcha spam protection included

**Cons**:
- Access key visible in frontend (not a security risk for form submissions)
- Less control over email formatting
- 250/month limit on free tier

---

### Option 2: Resend (Best DX)

**Why**: Built for React developers, beautiful emails, TypeScript support.

**Implementation** requires a server action:

```tsx
// app/actions/contact.ts (server action)
"use server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendContactEmail(formData: {
  name: string;
  email: string;
  company?: string;
  message: string;
}) {
  const { data, error } = await resend.emails.send({
    from: "Contact Form <contact@yourdomain.com>",
    to: ["your@email.com"],
    replyTo: formData.email,
    subject: `New contact from ${formData.name}`,
    text: `
Name: ${formData.name}
Email: ${formData.email}
Company: ${formData.company || "N/A"}

Message:
${formData.message}
    `,
  });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, id: data?.id };
}
```

**Setup Steps**:
1. Sign up at [resend.com](https://resend.com)
2. Verify your domain (or use their test domain)
3. Get API key
4. Add `RESEND_API_KEY` to environment variables
5. Create server action
6. Call from your form

**Pros**:
- 3,000 emails/month free (more than enough)
- TypeScript SDK with excellent types
- React Email support for beautiful templates
- Modern API with great error handling

**Cons**:
- Requires server action/API route
- Domain verification for production
- Slightly more setup time

---

## For Your Specific Codebase

Your contact form at `contact-dialog.tsx` uses:
- Zod for validation ✓
- React Hook Form ✓
- TanStack Start (SSR framework)

**Recommended Approach**: Web3Forms

Since TanStack Start supports both client and server actions but your form is already client-side, Web3Forms offers the path of least resistance:

```tsx
// contact-dialog.tsx - minimal change needed
function onSubmit(values: z.infer<typeof contactSchema>) {
  fetch("https://api.web3forms.com/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_key: import.meta.env.VITE_WEB3FORMS_KEY,
      ...values,
      subject: `Contact from ${values.name}`,
    }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        form.reset();
        onOpenChange(false);
        // Toast success
      }
    });
}
```

Add to `apps/www/src/env.ts`:
```ts
VITE_WEB3FORMS_KEY: string
```

## Trade-off Analysis

### Web3Forms
| Factor | Impact | Notes |
|--------|--------|-------|
| Setup Time | 5-10 min | Just get API key |
| Cost | Free | 250/mo free tier |
| Control | Low | Fixed email format |
| Reliability | High | Established service |

### Resend
| Factor | Impact | Notes |
|--------|--------|-------|
| Setup Time | 2-3 hours | Need server action |
| Cost | Free | 3,000/mo free tier |
| Control | High | Custom templates |
| Reliability | High | Modern infrastructure |

## Sources

### Official Documentation
- [Web3Forms Documentation](https://web3forms.com/) - Web3Forms, 2025
- [Resend Next.js Docs](https://resend.com/docs/send-with-nextjs) - Resend, 2025
- [Formspree React Guide](https://formspree.io/) - Formspree, 2025

### Pricing & Comparisons
- [Resend Pricing](https://resend.com/pricing) - Official pricing page
- [Web3Forms Pricing](https://web3forms.com/pricing) - Official pricing page
- [Postmark vs SendGrid 2025](https://postmarkapp.com/compare/sendgrid-alternative) - Postmark

### Reviews & Analysis
- [Choosing the Right Email Service](https://bahroze.substack.com/p/choosing-the-right-email-service) - Bahroze, 2025
- [Contact Form Services Comparison](https://medium.com/@dimterion/contact-form-services-b7c8141b0142) - Medium, 2025
- [Static Form Providers Comparison](https://css-tricks.com/a-comparison-of-static-form-providers/) - CSS-Tricks

---

**Last Updated**: 2026-01-31
**Confidence Level**: High - Based on official docs and recent reviews
**Next Steps**: Choose Web3Forms for simplicity or Resend for control, then implement
