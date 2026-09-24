export function Logo({ className = 'h-9', light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${light ? 'text-white' : 'text-navy-900'}`}>
      <svg viewBox="0 0 40 40" className={className} fill="none" aria-label="أموالي" role="img">
        <rect width="40" height="40" rx="11" fill="currentColor" />
        <path d="M10 28 L20 11 L30 28" stroke="#26d8ba" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14.5 22 H25.5" stroke={light ? '#0b1526' : '#ffffff'} strokeWidth="2.8" strokeLinecap="round" />
      </svg>
      <span className="text-[var(--text-lg)] font-extrabold tracking-tight">أموالي</span>
    </span>
  );
}
