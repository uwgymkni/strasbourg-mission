import { SchoolLogo } from "@/components/layout/SchoolLogo";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh flex flex-col items-center bg-navy-950 px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">

      {/* School logo — top of auth screens */}
      <div className="flex items-center gap-2.5 mt-8 mb-2">
        <SchoolLogo size={28} />
        <span className="text-xs text-stone-500 tracking-wide">BG/BRG Knittelfeld</span>
      </div>

      {/* Decorative accent */}
      <div className="w-px h-12 bg-gradient-to-b from-transparent to-gold-500/30 mb-6" />

      {/* Page content */}
      <div className="w-full max-w-sm flex-1 flex flex-col justify-center">
        {children}
      </div>

      {/* Bottom accent + school footer */}
      <div className="w-px h-12 bg-gradient-to-t from-transparent to-gold-500/10 mt-8" />
      <p className="text-center text-xs text-stone-700 tracking-wide py-4">
        Entwickelt am BG/BRG Knittelfeld
      </p>
    </div>
  );
}
