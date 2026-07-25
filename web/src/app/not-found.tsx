import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800 text-zinc-500">
        <SearchX className="h-7 w-7" />
      </div>
      <p className="mt-5 font-display text-5xl font-bold tracking-tight text-zinc-700">
        404
      </p>
      <h1 className="mt-2 font-display text-xl font-semibold">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-zinc-400">
        The page or team you&apos;re looking for doesn&apos;t exist in this league.
      </p>
      <Button render={<Link href="/" />} className="mt-6">
        <ArrowLeft className="h-4 w-4" />
        Back to overview
      </Button>
    </div>
  );
}
