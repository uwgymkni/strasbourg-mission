import { forwardRef } from "react";

type CardPadding = "sm" | "md" | "lg" | "none";

interface CardProps {
  children: React.ReactNode;
  padding?: CardPadding;
  interactive?: boolean;
  className?: string;
  onClick?: () => void;
}

const paddingClasses: Record<CardPadding, string> = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { children, padding = "md", interactive = false, className = "", onClick },
  ref
) {
  return (
    <div
      ref={ref}
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick?.();
            }
          : undefined
      }
      className={`
        bg-navy-800 border border-navy-700 rounded-2xl
        ${paddingClasses[padding]}
        ${
          interactive
            ? "cursor-pointer transition-colors duration-150 hover:border-gold-500/50 active:border-gold-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950"
            : ""
        }
        ${className}
      `}
    >
      {children}
    </div>
  );
});

export { Card };
export type { CardProps, CardPadding };
