"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const [code, setCode] = useState("");
  const router = useRouter();
  const { login, loading, error, clearError } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = await login(code.trim().toUpperCase());
    if (result.success) {
      router.push("/dashboard");
    }
  }

  return (
    <>
      <div className="text-center mb-10">
        <p className="text-gold-500 text-xs font-medium tracking-widest uppercase mb-4">
          Classified
        </p>
        <h1 className="font-display text-4xl font-semibold text-cream">
          Identify Your Team
        </h1>
        <p className="text-stone-400 text-sm mt-3 leading-relaxed">
          Enter the code provided by your mission coordinator.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="Team Code"
          value={code}
          onChange={(e) => {
            clearError();
            setCode(e.target.value);
          }}
          placeholder="e.g. ALPHA-1"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          error={error ?? undefined}
          disabled={loading}
        />

        <Button
          type="submit"
          variant="primary"
          loading={loading}
          disabled={!code.trim()}
          className="w-full"
        >
          Enter Mission
        </Button>
      </form>
    </>
  );
}
