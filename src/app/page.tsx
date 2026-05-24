"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/Button";
import { SchoolLogo } from "@/components/layout/SchoolLogo";

const MISSION_RULES = [
  "Arbeitet als Team — jeder Hinweis führt zum nächsten Ort.",
  "Beobachtet genau — die Antworten sind immer vor Ort sichtbar.",
  "Gebt eure Antwort erst ein, wenn ihr sicher seid.",
  "Gebt das Lösungswort ein, sobald alle Stationen abgeschlossen sind.",
];

export default function LandingPage() {
  const router = useRouter();

  // Users who reopen the app with an active session skip the landing page.
  // Admins go directly to Mission Control; students go to their dashboard.
  // getState() is used (not the hook) to avoid the useSyncExternalStore
  // snapshot-timing issue that can return null on first render after a hard reload.
  useEffect(() => {
    const user = useAuthStore.getState().user;
    if (user) {
      router.replace("/dashboard");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // once on mount — store is already rehydrated at this point

  return (
    <div className="min-h-dvh flex flex-col bg-navy-950 px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <main className="flex-1 flex flex-col items-center justify-center w-full max-w-sm mx-auto py-12">

        {/* School logo */}
        <div className="flex items-center gap-2.5 mb-10">
          <SchoolLogo size={28} />
          <span className="text-xs text-stone-500 tracking-wide">BG/BRG Knittelfeld</span>
        </div>

        {/* Emblem */}
        <div className="flex items-center justify-center w-20 h-20 rounded-full border border-gold-500/30">
          <div className="flex items-center justify-center w-12 h-12 rounded-full border border-gold-500/60">
            <div className="w-2 h-2 rounded-full bg-gold-500" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center mt-8">
          <p className="text-gold-500 text-xs font-medium tracking-widest uppercase mb-4">
            Geheim
          </p>
          <h1 className="font-display text-5xl font-semibold text-cream leading-tight">
            Strasbourg<br />Mission
          </h1>
          <p className="text-stone-400 mt-4 leading-relaxed">
            Entdeckt die Geheimnisse der Stadt.<br />Folgt den Hinweisen. Arbeitet als Team.
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
              Mission starten
            </Button>
          </Link>
        </div>

      </main>

      {/* School footer */}
      <p className="text-center text-xs text-stone-700 tracking-wide py-4">
        Entwickelt am BG/BRG Knittelfeld
      </p>
    </div>
  );
}
