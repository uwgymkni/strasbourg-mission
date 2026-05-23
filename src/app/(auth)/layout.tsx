export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-navy-950 px-6">
      {/* Subtle top accent */}
      <div className="w-px h-16 bg-gradient-to-b from-transparent to-gold-500/30 mb-8" />

      <div className="w-full max-w-sm">{children}</div>

      <div className="w-px h-16 bg-gradient-to-t from-transparent to-gold-500/10 mt-8" />
    </div>
  );
}
