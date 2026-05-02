export function TimelineSeparator() {
  return (
    <div className="my-3 flex items-center gap-3 px-4" aria-hidden>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#2f3e2f]/70 to-[#2f3e2f]" />
      <div className="h-2 w-2 shrink-0 rounded-full bg-[#d4a017] shadow-[0_0_10px_rgba(212,160,23,0.55)]" />
      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-[#2f3e2f]/70 to-[#2f3e2f]" />
    </div>
  );
}
