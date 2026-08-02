import { ChevronRight, History, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { AliasTag } from "@/components/cards/AliasTag";
import { StatCard } from "@/components/cards/StatCard";
import { OwnerLink } from "@/components/links/OwnerLink";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { getLeagueHistory, getSeasons } from "@/lib/queries";
import { getRevealState } from "@/lib/reveal";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

interface OwnerTeam {
  name: string;
  abbrev: string;
  color: string;
  years: number[];
}

interface OwnerEntry {
  key: string;
  name: string;
  color: string;
  aliasNum: number | null;
  years: number[];
  teams: OwnerTeam[];
}

function yearSpan(years: number[]): string {
  if (years.length === 0) return "";
  const min = Math.min(...years);
  const max = Math.max(...years);
  return min === max ? `${min}` : `${min}\u2013${max}`;
}

export default async function HistoryPage() {
  const rows = await getLeagueHistory();
  const revealed = await getRevealState();
  const seasonCount = getSeasons().length;

  const owners = new Map<string, OwnerEntry>();
  for (const row of rows) {
    const key = row.owner_id ?? row.owner_name;
    let owner = owners.get(key);
    if (!owner) {
      owner = {
        key,
        name: row.owner_name,
        color: row.color,
        aliasNum: row.owner_alias_num ?? null,
        years: [],
        teams: [],
      };
      owners.set(key, owner);
    }
    if (!owner.years.includes(row.year)) owner.years.push(row.year);
    let team = owner.teams.find((t) => t.name === row.team_name && t.abbrev === row.abbrev);
    if (!team) {
      team = { name: row.team_name, abbrev: row.abbrev, color: row.color, years: [] };
      owner.teams.push(team);
    }
    if (!team.years.includes(row.year)) team.years.push(row.year);
  }

  const ownerList = [...owners.values()].sort(
    (a, b) => b.years.length - a.years.length || a.name.localeCompare(b.name)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="League History"
        subtitle="Every owner who's ever fielded a team"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Reveal>
          <StatCard
            label="Seasons Tracked"
            value={seasonCount}
            icon={History}
            accent="#fbbf24"
          />
        </Reveal>
        <Reveal delay={0.05}>
          <StatCard
            label="All-Time Owners"
            value={ownerList.length}
            icon={Users}
            accent="#10b981"
          />
        </Reveal>
      </div>

      {ownerList.length === 0 ? (
        <Reveal>
          <p className="py-16 text-center text-sm text-zinc-500">
            No owners recorded yet.
          </p>
        </Reveal>
      ) : (
        <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" stagger={0.05}>
          {ownerList.map((owner) => (
            <StaggerItem key={owner.key}>
              <OwnerLink aliasNum={owner.aliasNum} className="block h-full">
                <Card className="group h-full border border-zinc-800 bg-zinc-900/60 py-0 ring-0 transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-700">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-display text-sm font-bold"
                        style={{ backgroundColor: `${owner.color}1f`, color: owner.color }}
                      >
                        {initials(owner.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        {revealed ? (
                          <p className="truncate font-display text-base font-bold transition-colors group-hover:text-emerald-400">
                            {owner.name}
                          </p>
                        ) : (
                          <AliasTag label={owner.name} />
                        )}
                        <p className="text-xs text-zinc-500">
                          {yearSpan(owner.years)} ·{" "}
                          {owner.years.length === 1 ? "1 season" : `${owner.years.length} seasons`}
                        </p>
                      </div>
                      {owner.aliasNum != null && (
                        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-700 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-zinc-400" />
                      )}
                    </div>

                    <div className="mt-4 space-y-1.5">
                      {owner.teams.map((team) => (
                        <div
                          key={`${team.abbrev}-${team.name}`}
                          className="flex items-center gap-2.5 rounded-lg bg-foreground/[0.03] px-2.5 py-2"
                        >
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-display text-[10px] font-bold"
                            style={{ backgroundColor: `${team.color}1f`, color: team.color }}
                          >
                            {team.abbrev}
                          </span>
                          {revealed ? (
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">
                              {team.name}
                            </span>
                          ) : (
                            <AliasTag label={team.name} className="min-w-0 flex-1" />
                          )}
                          {team.years.length > 1 && (
                            <span
                              className={cn(
                                "shrink-0 font-mono text-[10px] tabular-nums text-zinc-500"
                              )}
                            >
                              {yearSpan(team.years)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </OwnerLink>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
