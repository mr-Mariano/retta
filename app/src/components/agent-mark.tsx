/** The agent's avatar: a sparkle in a blue-violet circle. */
export function AgentMark({ size = 34, pulse = false }: { size?: number; pulse?: boolean }) {
  const icon = Math.round(size * 0.55);
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={`agent-mark flex shrink-0 items-center justify-center rounded-[6px] ${pulse ? "agent-pulse" : ""}`}
    >
      <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
        <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
      </svg>
    </span>
  );
}
