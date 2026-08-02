import Link from "next/link";
import type { ReactNode } from "react";

interface OwnerLinkProps {
  aliasNum: number | null | undefined;
  children: ReactNode;
  className?: string;
}

export function OwnerLink({ aliasNum, children, className }: OwnerLinkProps) {
  if (aliasNum == null) {
    return <span className={className}>{children}</span>;
  }
  return (
    <Link href={`/all-time/${aliasNum}`} className={className}>
      {children}
    </Link>
  );
}
