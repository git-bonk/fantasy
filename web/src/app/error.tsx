"use client";

import { useEffect } from "react";
import { Database, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const isDbError =
    /SQLITE|database|no such table|better-sqlite3|ENOENT|fileMustExist/i.test(
      error.message ?? ""
    );

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
        <Database className="h-7 w-7" />
      </div>
      <h1 className="mt-5 font-display text-2xl font-bold tracking-tight">
        {isDbError ? "League data unavailable" : "Something went wrong"}
      </h1>
      <p className="mt-2 max-w-md text-sm text-zinc-400">
        {isDbError
          ? "The dashboard couldn't read data/fantasynfl.db. Generate it with the pipeline (python -m fantasynfl sample) and reload."
          : "An unexpected error occurred while rendering this page. Try again."}
      </p>
      <Button onClick={reset} className="mt-6">
        <RefreshCw className="h-4 w-4" />
        Try again
      </Button>
    </div>
  );
}
