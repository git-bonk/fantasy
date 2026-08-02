import Link from "next/link";
import type { ReactNode } from "react";

interface PlayerLinkProps {
  playerId: number | null;
  children: ReactNode;
  className?: string;
}

export function PlayerLink({ playerId, children, className }: PlayerLinkProps) {
  if (playerId == null) {
    return <span className={className}>{children}</span>;
  }
  return (
    <Link href={`/players/${playerId}`} className={className}>
      {children}
    </Link>
  );
}
