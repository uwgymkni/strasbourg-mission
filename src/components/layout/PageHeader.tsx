interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  action?: React.ReactNode;
}

function PageHeader({ title, subtitle, onBack, action }: PageHeaderProps) {
  return (
    <header className="flex items-center gap-3 py-4">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="
            shrink-0 flex items-center justify-center
            w-10 h-10 -ml-2 rounded-xl
            text-cream hover:bg-navy-800 active:bg-navy-700
            transition-colors duration-150
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500
          "
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M12 5L7 10L12 15"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}

      <div className="flex-1 min-w-0">
        <h1 className="font-display text-xl font-semibold text-cream leading-tight truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-stone-400 mt-0.5 truncate">{subtitle}</p>
        )}
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export { PageHeader };
export type { PageHeaderProps };
