/** Danger triangle for alert boxes; colour comes from the box. */
export function WarningIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3 2.5 20h19Z" /><path d="M12 10v4.5" /><path d="M12 17.5v.5" />
    </svg>
  )
}
