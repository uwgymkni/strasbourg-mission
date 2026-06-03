"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { subscribeQuizState } from "@/services/quiz.service";
import type { QuizState } from "@/types/quiz";

/**
 * Surfaces a "Quiz läuft" entry on all game pages whenever a quiz is active
 * (countdown / question / reveal / finished) and the student isn't already on
 * /quiz. Read-only onSnapshot subscription; renders nothing when idle.
 */
export function QuizBanner() {
  const [state, setState] = useState<QuizState | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const unsub = subscribeQuizState(setState);
    return unsub;
  }, []);

  if (!state || state.phase === "idle") return null;
  if (pathname === "/quiz") return null;

  return (
    <Link
      href="/quiz"
      className="block rounded-xl border border-gold-500/50 bg-gold-500/10 px-4 py-2.5 mb-3 text-center text-sm font-medium text-gold-300 hover:bg-gold-500/15 transition-colors"
    >
      🎯 Quiz läuft — jetzt mitmachen →
    </Link>
  );
}
