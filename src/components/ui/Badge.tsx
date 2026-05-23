type BadgeVariant = "active" | "completed" | "locked" | "success" | "error";

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  active:    "bg-gold-500/15 text-gold-400 border border-gold-500/30",
  completed: "bg-emerald-950/60 text-emerald-400 border border-emerald-700/40",
  locked:    "bg-navy-900/80 text-stone-400 border border-navy-700/50",
  success:   "bg-emerald-950/60 text-emerald-400 border border-emerald-700/40",
  error:     "bg-red-950/60 text-red-400 border border-red-700/40",
};

function Badge({ variant, children, className = "" }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        px-3 py-1 rounded-full text-xs font-medium tracking-wide
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}

export { Badge };
export type { BadgeProps, BadgeVariant };
