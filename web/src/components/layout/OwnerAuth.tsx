"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LogOut, UserRound, X } from "lucide-react";
import { loginAsOwner, logoutOwner } from "@/lib/auth-actions";
import type { FormEvent } from "react";

interface OwnerAuthProps {
  owner: { aliasNum: number | null } | null;
}

export function OwnerAuth({ owner }: OwnerAuthProps) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await loginAsOwner(token);
    setPending(false);
    if (res.ok) {
      setToken("");
      setOpen(false);
      router.refresh();
    } else {
      setError(res.error ?? "Login failed.");
    }
  }

  async function handleLogout() {
    await logoutOwner();
    router.refresh();
  }

  if (owner) {
    return (
      <div className="flex items-center gap-2">
        <span
          title="Signed in with an owner token"
          className="flex h-9 items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 text-sm font-medium text-emerald-400"
        >
          <UserRound className="h-4 w-4" />
          <span className="hidden sm:inline">Owner {owner.aliasNum ?? 0}</span>
        </span>
        <button
          type="button"
          onClick={handleLogout}
          title="Sign out"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/60 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Sign in with your owner token"
        className="flex h-9 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 text-sm font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
      >
        <UserRound className="h-4 w-4" />
        <span className="hidden sm:inline">Owner login</span>
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
                      <h2 className="font-display text-lg font-bold">Owner login</h2>
                      <p className="mt-1 text-xs text-zinc-500">
                        Enter your owner token to make picks in the prediction game.
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
                  <form onSubmit={handleLogin} className="space-y-3">
                    <input
                      type="password"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      autoFocus
                      placeholder="Owner token"
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none transition-colors focus:border-emerald-500/60"
                    />
                    {error && <p className="text-xs text-rose-400">{error}</p>}
                    <button
                      type="submit"
                      disabled={pending || token.length === 0}
                      className="w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {pending ? "Signing in\u2026" : "Sign in"}
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
