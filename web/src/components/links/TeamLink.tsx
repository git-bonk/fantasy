import Link from "next/link";
import type { ReactNode } from "react";

interface TeamLinkProps {
  teamId: number;
  children: ReactNode;
  className?: string;
}

export function TeamLink({ teamId, children, className }: TeamLinkProps) {
  return (
    <Link href={`/teams/${teamId}`} className={className}>
      {children}
    </Link>
  );
}
