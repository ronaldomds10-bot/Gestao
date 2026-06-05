import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

export function Table({ className = "", ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table className={`w-full text-left text-sm ${className}`} {...props} />;
}

export function TableHeader({ className = "", ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={`bg-[#314863] text-xs uppercase text-white ${className}`} {...props} />;
}

export function TableBody({ className = "", ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={`divide-y divide-[#1E3A5F] text-white ${className}`} {...props} />;
}

export function TableRow({ className = "", ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={className} {...props} />;
}

export function TableHead({ className = "", ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={`px-4 py-3 font-semibold ${className}`} {...props} />;
}

export function TableCell({ className = "", ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`px-4 py-3 ${className}`} {...props} />;
}
