/** The Verdict mark: a face split down the middle, before on the left, after on the right. */
export function LogoMark({ size = 28, title }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="2.25" />
      <path d="M16 3 A13 13 0 0 1 16 29 Z" fill="var(--accent)" />
      <line x1="16" y1="1.5" x2="16" y2="30.5" stroke="currentColor" strokeWidth="2.25" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <LogoMark size={26} />
      <span className="display" style={{ fontSize: 24, lineHeight: 1, letterSpacing: "-0.02em" }}>
        Verdict
      </span>
    </span>
  );
}
