"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtPts } from "@/lib/format";
import { PositionBadge } from "./PositionBadge";
import type { PositionLeaders as PositionLeadersType } from "@/lib/types";

interface PositionLeadersProps {
  data: PositionLeadersType[];
}

export function PositionLeaders({ data }: PositionLeadersProps) {
  if (data.length === 0) return null;

  return (
    <Tabs defaultValue={data[0].position}>
      <TabsList>
        {data.map((group) => (
          <TabsTrigger key={group.position} value={group.position}>
            {group.position}
          </TabsTrigger>
        ))}
      </TabsList>
      {data.map((group) => (
        <TabsContent key={group.position} value={group.position} className="mt-4">
          <div className="space-y-2">
            {group.leaders.map((leader, i) => (
              <div
                key={leader.espn_player_id}
                className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2.5"
              >
                <span className="w-5 text-center font-mono text-xs font-bold tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <PositionBadge position={leader.position} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{leader.player_name}</p>
                  <p className="text-xs text-muted-foreground">{leader.games} games</p>
                </div>
                <span className="font-mono text-base font-bold tabular-nums">
                  {fmtPts(leader.total_points)}
                </span>
              </div>
            ))}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
