"use client";

import { useRequireAuth } from "@/hooks/useRequireAuth";
import { PageHeader } from "@/components/layout/PageHeader";
import { QuizStudent } from "@/components/quiz/QuizStudent";

export default function QuizPage() {
  const user = useRequireAuth();
  if (!user) return null;

  return (
    <>
      <PageHeader title="Quiz" subtitle={user.teamName} />
      <QuizStudent />
    </>
  );
}
