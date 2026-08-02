import { Card, CardContent } from "@/components/ui/card";
import { OwnerLink } from "@/components/links/OwnerLink";
import { fmtPts } from "@/lib/format";
import { letterGradeRank, type LetterGrade, type SeasonReportCard } from "@/lib/queries";

function gradeColor(grade: LetterGrade): string {
  if (grade === "—" ) return "#71717a";
  if (grade.startsWith("A")) return "#10b981";
  if (grade.startsWith("B")) return "#38bdf8";
  if (grade.startsWith("C")) return "#fbbf24";
  if (grade === "D") return "#f97316";
  return "#f43f5e";
}

function signed(n: number): string {
  return `${n > 0 ? "+" : ""}${fmtPts(n)}`;
}

interface MetricLineProps {
  label: string;
  value: string;
  grade: LetterGrade;
}

function MetricLine({ label, value, grade }: MetricLineProps) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-zinc-800/70 pt-2">
      <span className="text-[11px] font-semibold tracking-widest text-zinc-500 uppercase">
        {label}
      </span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-xs tabular-nums text-zinc-300">{value}</span>
        <span
          className="w-7 text-right font-display text-sm font-bold"
          style={{ color: gradeColor(grade) }}
        >
          {grade}
        </span>
      </span>
    </div>
  );
}

interface ReportCardItemProps {
  card: SeasonReportCard;
}

function ReportCardItem({ card }: ReportCardItemProps) {
  const { metrics, grades } = card;
  const compositeColor = gradeColor(grades.composite);

  const scoringValue =
    metrics.pfRank !== null ? `#${metrics.pfRank} of ${metrics.teamCount}` : "—";
  const luckValue = metrics.luckTotal !== null ? signed(metrics.luckTotal) : "—";
  const activityValue = metrics.activity !== null ? `${metrics.activity}` : "—";
  const waiverValue = metrics.waiverNet !== null ? signed(metrics.waiverNet) : "—";
  const consistencyValue = metrics.consistency !== null ? fmtPts(metrics.consistency) : "n/a";

  return (
    <Card className="relative overflow-hidden border border-zinc-800 bg-zinc-900/60 py-0 ring-0 transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-700">
      <div
        className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full blur-3xl"
        style={{ backgroundColor: `${compositeColor}14` }}
      />
      <CardContent className="relative p-4">
        <div className="flex items-start justify-between gap-3">
          <OwnerLink
            aliasNum={card.owner_alias_num}
            className="flex min-w-0 items-center gap-2 transition-colors hover:text-emerald-400"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: card.color }}
            />
            <span className="truncate font-display text-base font-semibold">{card.owner_name}</span>
          </OwnerLink>
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-display text-2xl font-bold"
            style={{ backgroundColor: `${compositeColor}1a`, color: compositeColor }}
          >
            {grades.composite}
          </span>
        </div>

        <div className="mt-3 space-y-2">
          <MetricLine label="Scoring" value={scoringValue} grade={grades.scoring} />
          <MetricLine label="Luck" value={luckValue} grade={grades.luck} />
          <MetricLine label="Activity" value={activityValue} grade={grades.activity} />
          <MetricLine label="Waiver Net" value={waiverValue} grade={grades.waiver} />
          <MetricLine label="Consistency" value={consistencyValue} grade={grades.consistency} />
        </div>
      </CardContent>
    </Card>
  );
}

interface ReportCardsProps {
  cards: SeasonReportCard[];
}

export function ReportCards({ cards }: ReportCardsProps) {
  if (cards.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">
        No report cards yet — grades appear once the season has standings and results.
      </p>
    );
  }

  const sorted = [...cards].sort(
    (a, b) =>
      letterGradeRank(b.grades.composite) - letterGradeRank(a.grades.composite) ||
      (a.owner_alias_num ?? 0) - (b.owner_alias_num ?? 0)
  );

  return (
    <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {sorted.map((card) => (
        <ReportCardItem key={card.owner_alias_num ?? card.owner_name} card={card} />
      ))}
    </div>
  );
}
