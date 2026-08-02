import type { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  description?: string;
  controls?: ReactNode;
}

export function SectionHeader({ title, description, controls }: SectionHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
        {description && <p className="mt-1 text-sm text-zinc-400">{description}</p>}
      </div>
      {controls && <div className="shrink-0">{controls}</div>}
    </div>
  );
}
