"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { saveTeamMembers } from "@/services/game.service";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const MIN_MEMBERS = 2;
const MAX_MEMBERS = 6;

function MemberInput({
  index,
  value,
  onChange,
  autoFocus,
}: {
  index: number;
  value: string;
  onChange: (val: string) => void;
  autoFocus?: boolean;
}) {
  const isRequired = index < MIN_MEMBERS;
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={`member-${index}`}
        className="text-sm font-medium text-stone-300"
      >
        Schüler/in {index + 1}
        {isRequired && <span className="text-gold-500 ml-1">*</span>}
      </label>
      <input
        id={`member-${index}`}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={isRequired ? "Pflichtfeld" : "Optional"}
        autoFocus={autoFocus}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={40}
        className="
          w-full min-h-[52px] px-4 rounded-xl
          bg-navy-800 text-cream text-base
          border border-navy-700
          transition-colors duration-150
          placeholder:text-stone-500
          focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500
          disabled:opacity-50
        "
      />
    </div>
  );
}

export default function TeamMembersPage() {
  const router = useRouter();
  const user = useRequireAuth();

  // Always render MAX_MEMBERS slots; empty trailing ones are ignored on save
  const [members, setMembers] = useState<string[]>(
    Array.from({ length: MAX_MEMBERS }, () => "")
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Count non-empty entries
  const filledCount = members.filter((m) => m.trim().length > 0).length;
  const canSubmit = filledCount >= MIN_MEMBERS && !saving;

  if (!user) return null;

  function handleChange(index: number, value: string) {
    setError(null);
    setMembers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = members.map((m) => m.trim()).filter(Boolean);

    if (trimmed.length < MIN_MEMBERS) {
      setError(`Bitte mindestens ${MIN_MEMBERS} Namen eingeben.`);
      return;
    }

    setSaving(true);
    const result = await saveTeamMembers(user!.teamCode, trimmed);
    setSaving(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <>
      <PageHeader
        title="Teammitglieder"
        subtitle={user.teamName}
      />

      <div className="flex-1 flex flex-col gap-5 pb-10">

        <Card padding="md">
          <p className="text-sm text-stone-400 leading-relaxed">
            Gebt die Namen aller Teammitglieder ein. Mindestens{" "}
            <span className="text-cream">{MIN_MEMBERS} Namen</span> sind erforderlich,
            maximal {MAX_MEMBERS}.
          </p>
        </Card>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {members.map((value, i) => (
            <MemberInput
              key={i}
              index={i}
              value={value}
              onChange={(val) => handleChange(i, val)}
              autoFocus={i === 0}
            />
          ))}

          {error && (
            <p role="alert" className="text-sm text-red-400 -mt-1">
              {error}
            </p>
          )}

          <div className="pt-2 flex flex-col gap-3">
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              disabled={!canSubmit}
              className="w-full"
            >
              Weiter zur Mission
            </Button>

            {/* Allow skipping for coordinators or re-logins */}
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="text-sm text-stone-500 hover:text-stone-400 transition-colors duration-150 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 rounded"
            >
              Überspringen
            </button>
          </div>
        </form>

      </div>
    </>
  );
}
