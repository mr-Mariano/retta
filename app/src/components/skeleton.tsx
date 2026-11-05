/** Placeholder block shown while a page loads, so a tap answers right away. */
export function Bone({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`bone rounded-2xl ${className}`} />;
}
