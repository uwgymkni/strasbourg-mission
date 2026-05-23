"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore, selectUser } from "@/stores/auth.store";
import { Button } from "@/components/ui/Button";

const MISSION_RULES = [
  "Work as a team — every clue leads to the next location.",
  "Observe carefully — answers are always visible on site.",
  "Enter your code only once you are certain.",
  "Submit your final word when all stations are complete.",
];

export default function LandingPage() {
  const router = useRouter();
  const user = useAuthStore(selectUser);

  // Students who reopen the app with an active session skip the landing page.
  useEffect(() => {
    if (user) {
      router.replace("/dashboard");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // once on mount — redirects before the user can interact

  return (
    <div className="min-h-dvh flex flex-col bg-navy-950 px-6">
      <main className="flex-1 flex flex-col items-center justify-center w-full max-w-sm mx-auto py-16">

        {/* Emblem */}
        <div className="flex items-center justify-center w-20 h-20 rounded-full border border-gold-500/30">
          <div className="flex items-center justify-center w-12 h-12 rounded-full border border-gold-500/60">
            <div className="w-2 h-2 rounded-full bg-gold-500" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center mt-8">
          <p className="text-gold-500 text-xs font-medium tracking-widest uppercase mb-4">
            Classified
          </p>
          <h1 className="font-display text-5xl font-semibold text-cream leading-tight">
            Strasbourg<br />Mission
          </h1>
          <p className="text-stone-400 mt-4 leading-relaxed">
            Uncover the city's secrets.<br />Follow the clues. Work as a team.
          </p>
        </div>

        {/* Rules */}
        <div className="w-full mt-10 space-y-3">
          {MISSION_RULES.map((rule) => (
            <div key={rule} className="flex items-start gap-3 text-sm text-stone-400">
              <span className="text-gold-600 mt-0.5 shrink-0">—</span>
              <span className="leading-relaxed">{rule}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="w-full mt-10">
          <Link href="/login" className="block">
            <Button variant="primary" className="w-full">
              Start Mission
            </Button>
          </Link>
        </div>

      </main>
    </div>
  );
}
