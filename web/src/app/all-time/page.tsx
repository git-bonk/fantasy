import { ChevronRight, Crown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { AliasTag } from "@/components/cards/AliasTag";
import { OwnerLink } from "@/components/links/OwnerLink";
import { AnimatedRow, Reveal } from "@/components/motion/Reveal";
import { getOwnerStandings } from "@/lib/queries";
import { getRevealState } from "@/lib/reveal";
import { fmtPct, initials, ownerColor } from "@/lib/format";
import { cn } from "@/lib/utils";

function rankClasses(i: number): string {
  if (i === 0) return "bg-amber-400/15 text-amber-400";
  if (i === 1) return "bg-zinc-300/10 text-zinc-300";
  if (i === 2) return "bg-orange-600/15 text-orange-500";
  return "bg-zinc-800 text-zinc-400";
}

export default async function AllTimePage() {
  const standings = await getOwnerStandings();
  const revealed = await getRevealState();

  return (
    <div className="space-y-6">
      <PageHeader
        title="All-Time Rankings"
        subtitle="Running Elo across every season, keyed by owner"
      />

      {standings.length === 0 ? (
        <Reveal>
          <Card className="border border-zinc-800 bg-zinc-900/60 py-0 ring-0">
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <Crown className="h-8 w-8 text-zinc-600" />
              <p className="max-w-sm text-sm text-zinc-500">
                All-time rankings appear once your league has ingested owner data. They
                track a running Elo that carries across seasons.
              </p>
            </CardContent>
          </Card>
        </Reveal>
      ) : (
        <Reveal>
          <Card className="border border-zinc-800 bg-zinc-900/60 py-0 ring-0">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="w-14 text-zinc-500">Rank</TableHead>
                    <TableHead className="text-zinc-500">Owner</TableHead>
                    <TableHead className="text-right text-zinc-500">Rating</TableHead>
                    <TableHead className="text-right text-zinc-500">Record</TableHead>
                    <TableHead className="text-right text-zinc-500">Win%</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standings.map((o, i) => {
                    const color = ownerColor(o.owner_id);
                    const games = o.wins + o.losses + o.ties;
                    const winPct = games > 0 ? o.wins / games : null;
                    const record =
                      o.ties > 0
                        ? `${o.wins}-${o.losses}-${o.ties}`
                        : `${o.wins}-${o.losses}`;
                    return (
                      <AnimatedRow
                        key={o.owner_id}
                        delay={i * 0.03}
                        className="border-zinc-800/70 transition-colors hover:bg-foreground/[0.03]"
                      >
                        <TableCell className="py-3">
                          <span
                            className={cn(
                              "flex h-7 w-7 items-center justify-center rounded-lg font-mono text-xs font-bold tabular-nums",
                              rankClasses(i)
                            )}
                          >
                            {i + 1}
                          </span>
                        </TableCell>
                        <TableCell className="py-3">
                          <OwnerLink
                            aliasNum={o.owner_alias_num}
                            className="group flex items-center gap-2.5"
                          >
                            <span
                              className="flex h-8 w-8 items-center justify-center rounded-lg font-display text-[10px] font-bold"
                              style={{ backgroundColor: `${color}1f`, color }}
                            >
                              {initials(o.display_name)}
                            </span>
                            {revealed ? (
                              <span className="font-semibold transition-colors group-hover:text-emerald-400">
                                {o.display_name}
                              </span>
                            ) : (
                              <AliasTag label={o.display_name} />
                            )}
                          </OwnerLink>
                        </TableCell>
                        <TableCell className="py-3 text-right font-mono text-base font-bold tabular-nums">
                          {Math.round(o.rating)}
                        </TableCell>
                        <TableCell className="py-3 text-right font-mono text-sm font-semibold tabular-nums text-zinc-300">
                          {record}
                        </TableCell>
                        <TableCell className="py-3 text-right font-mono text-sm tabular-nums text-zinc-400">
                          {winPct === null ? "—" : fmtPct(winPct)}
                        </TableCell>
                        <TableCell className="py-3 pr-4 text-right">
                          <ChevronRight className="ml-auto h-4 w-4 text-zinc-600" />
                        </TableCell>
                      </AnimatedRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Reveal>
      )}
    </div>
  );
}
