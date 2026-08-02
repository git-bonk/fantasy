"use client";

import { Fragment, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function NavRemount({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <Fragment key={`${pathname}?${searchParams.toString()}`}>{children}</Fragment>
  );
}
