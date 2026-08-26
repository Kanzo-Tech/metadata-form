/** Inline label + control, used by the example pickers in the utility strip. */
export function Field({
  label,
  children,
  size = "sm",
}: {
  label: string;
  children: React.ReactNode;
  size?: "xs" | "sm";
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`me-2 text-muted-foreground ${size === "xs" ? "text-xs" : "text-sm"}`}>
        {label}
      </span>
      {children}
    </div>
  );
}
