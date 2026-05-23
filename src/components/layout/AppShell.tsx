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
    </div>
  );
}

export { AppShell };
export type { AppShellProps };
