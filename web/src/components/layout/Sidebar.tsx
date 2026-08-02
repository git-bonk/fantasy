"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Trophy,
  ClipboardList,
  Newspaper,
  TrendingUp,
  Brain,
  Target,
  Users,
  Swords,
  Star,
  ArrowLeftRight,
  Medal,
  History,
  Crown,
  Gavel,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSeason } from "@/lib/season-context";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/rankings", label: "Rankings", icon: Trophy },
  { href: "/all-time", label: "All-Time", icon: Crown },
  { href: "/scores", label: "Scores", icon: ClipboardList },
  { href: "/recap", label: "Recap", icon: Newspaper },
  { href: "/trends", label: "Trends", icon: TrendingUp },
  { href: "/predict", label: "Model", icon: Brain },
  { href: "/predictions", label: "Predictions", icon: Target },
  { href: "/teams", label: "Teams", icon: Users },
  { href: "/history", label: "League History", icon: History },
  { href: "/playoffs", label: "Playoffs", icon: Swords },
  { href: "/players", label: "Players", icon: Star },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/draft", label: "Draft", icon: Gavel },
  { href: "/records", label: "Records", icon: Medal },
];

export function Sidebar() {
  const pathname = usePathname();
  const { withParams } = useSeason();

  return (
    <>
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-56 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Trophy className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display text-sm font-semibold tracking-tight">
            Fantasy NFL
          </span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={withParams(item.href)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <nav className="no-scrollbar fixed bottom-0 left-0 right-0 z-40 flex items-center gap-1 overflow-x-auto border-t border-sidebar-border bg-sidebar px-2 py-2 md:hidden">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={withParams(item.href)}
              className={cn(
                "flex min-w-16 shrink-0 flex-col items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
