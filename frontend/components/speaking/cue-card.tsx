/**
 * The Part 2 cue card as the examiner hands it over: the topic, "You should say:", the prompts,
 * and the closing "and explain" line. A real artifact: white card, one border, no shadow.
 */
export function CueCard({
  topic,
  bullets,
  closing,
}: {
  topic: string;
  bullets: string[];
  closing: string;
}) {
  return (
    <article className="rounded-2xl border border-border bg-sheet p-6 sm:p-8">
      <p className="mb-5 text-sm text-soft">Part 2 cue card</p>
      <h2 className="text-[22px] leading-snug font-medium text-ink sm:text-[24px]">{topic}</h2>
      <p className="mt-5 text-[17px] text-ink">You should say:</p>
      <ul className="mt-2 flex flex-col gap-1.5 pl-5">
        {bullets.map((b) => (
          <li key={b} className="list-disc text-[17px] leading-relaxed text-ink marker:text-soft">
            {b}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[17px] leading-relaxed text-ink">{closing}</p>
    </article>
  );
}
