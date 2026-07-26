import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface AliasTagProps {
  label: string;
  className?: string;
}

export function AliasTag({ label, className }: AliasTagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900/80 px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-tight text-zinc-400",
        className
      )}
    >
      <Lock className="h-2.5 w-2.5 text-zinc-600" />
      {label}
    </span>
  );
}
