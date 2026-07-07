const items = [
  "Speaking Practice",
  "Writing Feedback",
  "Reading Drills",
  "Listening Tests",
  "Band 7+ Target",
  "Official Criteria",
  "Pronunciation Review",
  "Study Planner",
];

export function BandMarquee() {
  const doubled = [...items, ...items];

  return (
    <div className="relative border-y border-stone-200/60 bg-white/60 backdrop-blur-sm overflow-hidden py-3.5">
      <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-24 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-24 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
      <div className="flex animate-marquee whitespace-nowrap">
        {doubled.map((item, i) => (
          <span key={`${item}-${i}`} className="inline-flex items-center mx-6 sm:mx-8">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mr-3 shrink-0" />
            <span className="text-xs sm:text-sm font-semibold text-slate-500 tracking-wide uppercase">
              {item}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
