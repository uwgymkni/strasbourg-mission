import { AppShell } from "@/components/layout/AppShell";
import { MissionBanner } from "@/components/MissionBanner";
import { QuizBanner } from "@/components/quiz/QuizBanner";

export default function GameLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AppShell>
      <MissionBanner />
      <QuizBanner />
      {children}
    </AppShell>
  );
}
