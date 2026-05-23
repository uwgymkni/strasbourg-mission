interface AppShellProps {
  children: React.ReactNode;
  footer?: React.ReactNode;
}

function AppShell({ children, footer }: AppShellProps) {
  return (
    <div className="min-h-dvh flex flex-col bg-navy-950">
      <main
        className="
          flex-1 flex flex-col
          w-full mx-auto max-w-[448px]
          px-4
          pt-[env(safe-area-inset-top)]
          pb-[env(safe-area-inset-bottom)]
        "
      >
        {children}
      </main>

      {footer && (
        <footer
          className="
            w-full mx-auto max-w-[448px]
            px-4
            pb-[env(safe-area-inset-bottom)]
          "
        >
          {footer}
        </footer>
      )}

      {/* School credit — shown on all game pages */}
      <div className="w-full py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <p className="text-center text-xs text-stone-700 tracking-wide">
          Entwickelt am BG/BRG Knittelfeld
        </p>
      </div>
    </div>
  );
}

export { AppShell };
export type { AppShellProps };
