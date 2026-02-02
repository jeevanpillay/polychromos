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
      const error: unknown = await response.json().catch(() => ({}));
      console.error("Clerk waitlist API error:", error);
      throw new Error("Failed to join waitlist. Please try again.");
    }

    return { success: true };
  });
