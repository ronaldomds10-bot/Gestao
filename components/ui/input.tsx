import type { InputHTMLAttributes } from "react";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-md border border-[#3B5B82] bg-[#233B5D] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-[#B8C7D9] focus:border-[#A855F7] focus:ring-4 focus:ring-[#A855F7]/20 ${className}`}
      {...props}
    />
  );
}
