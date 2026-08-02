import type { ReactNode } from "react";
import { Reveal } from "@/components/motion/Reveal";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  leading?: ReactNode;
}

export function PageHeader({ title, subtitle, action, leading }: PageHeaderProps) {
  return (
    <Reveal>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4">
          {leading}
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
              {title}
            </h1>
            {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </Reveal>
  );
}
