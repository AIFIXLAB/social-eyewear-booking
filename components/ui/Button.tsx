import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg" | "sm";

const variants: Record<Variant, string> = {
  primary: "bg-brand-700 text-white hover:bg-brand-800 disabled:bg-brand-700/40",
  secondary: "border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 disabled:text-neutral-400",
  ghost: "text-brand-700 hover:bg-brand-50 disabled:text-neutral-400",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-600/40",
};
const sizes: Record<Size, string> = {
  sm: "min-h-9 px-3 text-sm rounded-lg",
  md: "min-h-11 px-4 text-sm rounded-xl",
  lg: "min-h-[52px] px-5 text-base rounded-xl",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 font-semibold transition-colors focus:outline-none
        focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}
