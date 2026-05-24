"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { fetchAllTeams } from "@/services/auth.service";
import type { AppUser } from "@/types/user";

export default function LoginPage() {
  const [selectedCode, setSelectedCode] = useState("");
  const [teams, setTeams] = useState<AppUser[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamsError, setTeamsError] = useState<string | null>(null);

  const router = useRouter();
  const { login, loading, error, clearError } = useAuth();

  // Load team list from Firestore on mount
  useEffect(() => {
    async function loadTeams() {
      setTeamsLoading(true);
      const result = await fetchAllTeams();
      if (result.success) {
        // Sort alphabetically by teamName; exclude any residual admin-role docs
        const sorted = [...result.data]
          .filter((t) => t.role === "student")
          .sort((a, b) => a.teamName.localeCompare(b.teamName, "de"));
        setTeams(sorted);
      } else {
        setTeamsError("Teams konnten nicht geladen werden. Verbindung prüfen.");
      }
      setTeamsLoading(false);
    }
    void loadTeams();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCode) return;
    const result = await login(selectedCode);
    if (result.success) {
      router.push("/team-members");
    }
  }

  const isSubmitDisabled = !selectedCode || loading || teamsLoading;

  return (
    <>
      <div className="text-center mb-10">
        <p className="text-gold-500 text-xs font-medium tracking-widest uppercase mb-4">
          Geheim
        </p>
        <h1 className="font-display text-4xl font-semibold text-cream">
          Team auswählen
        </h1>
        <p className="text-stone-400 text-sm mt-3 leading-relaxed">
          Wählt euer Team aus der Liste aus und startet die Mission.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>

        {/* Team dropdown */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="team-select"
            className="text-sm font-medium text-stone-300"
          >
            Team
          </label>

          {teamsLoading ? (
            <div className="w-full min-h-[52px] px-4 rounded-xl bg-navy-800 border border-navy-700 flex items-center gap-3 animate-pulse">
              <span className="w-4 h-4 rounded-full border-2 border-stone-600 border-t-transparent animate-spin shrink-0" />
              <span className="text-stone-500 text-sm">Teams werden geladen …</span>
            </div>
          ) : teamsError ? (
            <div className="w-full min-h-[52px] px-4 rounded-xl bg-navy-800 border border-red-500/60 flex items-center">
              <span className="text-red-400 text-sm">{teamsError}</span>
            </div>
          ) : (
            <select
              id="team-select"
              value={selectedCode}
              onChange={(e) => {
                clearError();
                setSelectedCode(e.target.value);
              }}
              disabled={loading}
              className="
                w-full min-h-[52px] px-4 rounded-xl
                bg-navy-800 text-cream text-base
                border border-navy-700
                transition-colors duration-150
                focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500
                disabled:opacity-50 disabled:cursor-not-allowed
                appearance-none
                [&>option]:bg-navy-800
                [&>option]:text-cream
              "
              aria-label="Team auswählen"
            >
              <option value="" disabled>
                Bitte Team auswählen
              </option>
              {teams.map((team) => (
                <option key={team.teamCode} value={team.teamCode}>
                  {team.teamName} ({team.teamCode})
                </option>
              ))}
            </select>
          )}

          {/* Login error */}
          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}
        </div>

        <Button
          type="submit"
          variant="primary"
          loading={loading}
          disabled={isSubmitDisabled}
          className="w-full"
        >
          Mission starten
        </Button>
      </form>
    </>
  );
}
