import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "destructive";
};

const variants = {
  primary: "bg-[#FF5A00] text-white hover:bg-[#E65000] shadow-lg shadow-[#FF5A00]/20",
  secondary: "border border-[#3B5B82] bg-[#233B5D] text-white hover:bg-[#314863]",
  ghost: "text-[#CBD5E1] hover:bg-[#233B5D] hover:text-white",
  destructive: "bg-red-600 text-white hover:bg-red-700",
};

export function Button({
  className = "",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
