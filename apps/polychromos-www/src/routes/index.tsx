import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import type { z } from "zod";

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
        {/* <Button size="default" className="rounded-none">
          <span className="mr-1">↗</span> GET EARLY ACCESS
        </Button> */}
      </header>

      {/* Main Content */}
      <main className="flex flex-1 flex-col px-6 lg:px-12">
        {/* Hero Section */}
        <div className="mt-16 lg:mt-24">
          {/* Value Proposition */}
          <div className="flex max-w-xl flex-col">
            <div className="font-pp-neue text-xl leading-relaxed font-medium lg:text-2xl space-y-4">
              <p>
                Bridge the gap between Figma and React. Direct manipulation of
                the DOM with a designer-friendly interface.
              </p>
              <p>Code-first. Real-time. No more handoff friction.</p>
            </div>

            {/* Form Section - min-height prevents layout shift when states change */}
            <div className="mt-8 min-h-[100px] space-y-3">
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

      </main>

      {/* Bottom Large Typography - absolutely positioned to isolate from main content flow */}
      <div className="absolute bottom-0 left-0 right-0 px-6 pb-8 lg:px-12 lg:pb-12 pointer-events-none">
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
    </div>
  );
}
