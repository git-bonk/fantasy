"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Eye, EyeOff, Lock, X } from "lucide-react";
import { setReveal, unlock } from "@/lib/actions";
import { cn } from "@/lib/utils";

interface RevealToggleProps {
  unlocked: boolean;
  revealed: boolean;
}

export function RevealToggle({ unlocked, revealed }: RevealToggleProps) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await unlock(passcode);
    setPending(false);
    if (res.ok) {
      setPasscode("");
      setOpen(false);
      router.refresh();
    } else {
      setError(res.error ?? "Unlock failed.");
    }
  }

  async function handleToggle() {
    await setReveal(!revealed);
    router.refresh();
  }

  if (unlocked) {
    return (
      <button
        type="button"
        onClick={handleToggle}
        title={revealed ? "Hide owner and team names" : "Show owner and team names"}
        className={cn(
          "flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors",
          revealed
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:border-emerald-500/60"
            : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
        )}
      >
        {revealed ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        <span className="hidden sm:inline">{revealed ? "Revealed" : "Hidden"}</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Unlock identities"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/60 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
      >
        <Lock className="h-4 w-4" />
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-24 backdrop-blur-sm"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduce ? undefined : { opacity: 0 }}
                onClick={() => setOpen(false)}
              >
                <motion.div
                  className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl ring-1 ring-foreground/5"
                  initial={reduce ? false : { opacity: 0, scale: 0.95, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, scale: 0.95, y: -8 }}
                  transition={{ duration: 0.18, ease: [0.21, 0.47, 0.32, 0.98] }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-lg font-bold">Unlock identities</h2>
                      <p className="mt-1 text-xs text-zinc-500">
                        Enter the league passcode to reveal owner and team names.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="shrink-0 text-zinc-500 transition-colors hover:text-zinc-300"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <form onSubmit={handleUnlock} className="space-y-3">
                    <input
                      type="password"
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                      autoFocus
                      placeholder="Passcode"
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none transition-colors focus:border-emerald-500/60"
                    />
                    {error && <p className="text-xs text-rose-400">{error}</p>}
                    <button
                      type="submit"
                      disabled={pending || passcode.length === 0}
                      className="w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {pending ? "Unlocking\u2026" : "Unlock"}
                    </button>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
