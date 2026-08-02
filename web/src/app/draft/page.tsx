import { getDraft, getDraftValue, roundValues, teamBestWorst } from "@/lib/queries";
import { resolveSeason } from "@/lib/resolve-season";
import { DraftBoard } from "@/components/draft/DraftBoard";
import { BestWorstCards } from "@/components/draft/BestWorstCards";
import { RoundValueChart } from "@/components/draft/RoundValueChart";
import { Reveal } from "@/components/motion/Reveal";

export default async function DraftPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; week?: string }>;
}) {
  const ctx = await resolveSeason(searchParams);
  const seasonId = ctx.seasonId;
  const [picks, value] = await Promise.all([getDraft(seasonId), getDraftValue(seasonId)]);
  const bestWorst = teamBestWorst(value);
  const rounds = roundValues(value);

  return (
    <div className="space-y-8">
      <Reveal>
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Draft</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Draft day retrospective: the full board, every team&apos;s steals and busts, and where
            the value was found.
          </p>
        </div>
      </Reveal>

      {picks.length === 0 ? (
        <Reveal delay={0.05}>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-8 text-center text-sm text-zinc-400">
            No draft data for this season yet.
          </div>
        </Reveal>
      ) : (
        <>
          <Reveal delay={0.05}>
            <section className="space-y-4">
              <h2 className="font-display text-xl font-semibold tracking-tight">Draft board</h2>
              <DraftBoard picks={picks} />
            </section>
          </Reveal>

          {bestWorst.length > 0 && (
            <Reveal delay={0.1}>
              <section className="space-y-4">
                <div>
                  <h2 className="font-display text-xl font-bold tracking-tight">
                    Steals &amp; busts
                  </h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Each team&apos;s best and worst pick, by points produced versus the round&apos;s
                    average.
                  </p>
                </div>
                <BestWorstCards teams={bestWorst} />
              </section>
            </Reveal>
          )}

          {rounds.length > 0 && (
            <Reveal delay={0.15}>
              <section className="space-y-4">
                <div>
                  <h2 className="font-display text-xl font-bold tracking-tight">Value by round</h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Average season points produced by picks in each round.
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                  <RoundValueChart data={rounds} />
                </div>
              </section>
            </Reveal>
          )}
        </>
      )}
    </div>
  );
}
