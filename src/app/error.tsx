"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("[strasbourg-mission] Unhandled error:", error);
  }, [error]);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-navy-950 px-6">
      <div className="w-full max-w-sm text-center">
        <p className="text-gold-500 text-xs font-medium tracking-widest uppercase mb-4">
          Something went wrong
        </p>
        <h1 className="font-display text-3xl font-semibold text-cream mb-3">
          Unexpected error
        </h1>
        <p className="text-stone-400 text-sm leading-relaxed mb-8">
          The mission hit a snag. Try restarting this screen, or return to the
          dashboard.
        </p>
        <div className="flex flex-col gap-3">
          <Button variant="primary" className="w-full" onClick={reset}>
            Try again
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => {
              window.location.href = "/dashboard";
            }}
          >
            Return to dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
