import { AppShell } from "@/components/layout/AppShell";

export default function GameLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}
