/** One dot per place (session 7): taken ones filled, the ones still missing for the minimum outlined in the accent. */
export function CapacityDots({ active, min, max, size = "md" }: { active: number; min: number; max: number; size?: "sm" | "md" }) {
  return (
    <ol aria-label={`${active} de ${max} lugares ocupados, mínimo ${min}`} className="flex flex-wrap gap-1.5">
      {Array.from({ length: max }, (_, i) => (
        <li
          key={i}
          aria-hidden="true"
          className={`${size === "sm" ? "size-3" : "size-4"} rounded-[6px] ${
            i < active ? "bg-action" : i < min ? "border-[1.5px] border-action" : "border-[1.5px] border-muted/40"
          }`}
        />
      ))}
    </ol>
  );
}
