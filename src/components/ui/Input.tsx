import { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, id, className = "", ...props },
  ref
) {
  // Fall back to a sanitized label if no id is provided
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  const errorId = `${inputId}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-stone-300">
        {label}
      </label>

      <input
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        className={`
          w-full min-h-[52px] px-4 rounded-xl
          bg-navy-800 text-cream text-base
          border transition-colors duration-150
          placeholder:text-stone-500
          focus:outline-none focus:ring-2 focus:ring-gold-500
          disabled:opacity-50 disabled:cursor-not-allowed
          [&:-webkit-autofill]:[box-shadow:0_0_0_50px_#1A2744_inset]
          [&:-webkit-autofill]:[-webkit-text-fill-color:#F0EBE1]
          ${error ? "border-red-500" : "border-navy-700 focus:border-gold-500"}
          ${className}
        `}
        {...props}
      />

      {error && (
        <p id={errorId} role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
});

export { Input };
export type { InputProps };
