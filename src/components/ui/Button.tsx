import { forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-gold-500 text-navy-950 font-semibold hover:bg-gold-400 active:bg-gold-600",
  secondary:
    "border border-gold-500 text-gold-500 hover:bg-navy-800 active:bg-navy-700",
  ghost:
    "text-cream hover:bg-navy-800 active:bg-navy-700",
  danger:
    "bg-red-800 text-cream hover:bg-red-700 active:bg-red-900",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", loading = false, disabled, children, className = "", ...props },
  ref
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type="button"
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={loading}
      className={`
        inline-flex items-center justify-center gap-2
        min-h-[48px] px-6 rounded-xl text-base
        transition-colors duration-150
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500
        focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950
        ${variantClasses[variant]}
        ${isDisabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "cursor-pointer"}
        ${className}
      `}
      {...props}
    >
      {loading && (
        <span
          className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
});

export { Button };
export type { ButtonProps, ButtonVariant };
