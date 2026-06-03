import { AppShell } from "@/components/layout/AppShell";
import { MissionBanner } from "@/components/MissionBanner";

export default function GameLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AppShell>
      <MissionBanner />
      {children}
    </AppShell>
  );
}
