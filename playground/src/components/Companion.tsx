import { useState } from "react";
import { Button, Card, CardContent } from "@kanzo-tech/ui";
import { XIcon } from "lucide-react";
import type { FormMood, FormReport } from "@kanzo-tech/metadata-form";
import { fill, useChrome } from "../i18n.js";

/** One emoji per mood, on a halo tinted by the theme's own status colours. */
const FACE: Record<FormMood, { face: string; halo: string }> = {
  idle: { face: "🙂", halo: "var(--muted)" },
  guiding: { face: "🤔", halo: "var(--muted)" },
  celebrating: { face: "🎉", halo: "color-mix(in oklab, var(--success) 20%, transparent)" },
  warning: { face: "😟", halo: "color-mix(in oklab, var(--warning) 20%, transparent)" },
};

/**
 * A corner companion that reads the form's report — its health, its progress and
 * the next required field — and, when pressed, takes the reader to that field.
 * A progress affordance of this demo, not part of the library: it needs nothing
 * from the form but `form.report` and `form.revealField`.
 */
export function Companion({
  report: { health, progress, nextField },
  onReveal,
  onDismiss,
  offset,
}: {
  report: FormReport;
  onReveal: (fieldId: string) => void;
  onDismiss: () => void;
  /** How far the companion sits above the bottom edge. */
  offset: string;
}) {
  const { companion } = useChrome();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const { face, halo } = FACE[health.mood];
  const line =
    health.mood === "warning" || health.mood === "guiding"
      ? fill(companion[health.mood], { n: health.count })
      : companion[health.mood];
  const activate = nextField ? () => onReveal(nextField.id) : undefined;

  return (
    <div className="fixed z-50 end-6" style={{ bottom: offset }}>
      <Card
        style={{ maxWidth: "17.5rem", cursor: activate ? "pointer" : undefined }}
        role={activate ? "button" : undefined}
        tabIndex={activate ? 0 : undefined}
        onClick={activate}
        onKeyDown={(e) => activate && (e.key === "Enter" || e.key === " ") && activate()}
      >
        <CardContent className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-flex size-11 shrink-0 select-none items-center justify-center rounded-full text-2xl"
            style={{ background: halo }}
          >
            {face}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-sm font-medium">{line}</p>
            {nextField ? (
              <p className="text-xs text-muted-foreground">{fill(companion.next, { field: nextField.label })}</p>
            ) : (
              progress.total > 0 && (
                <p className="text-xs text-muted-foreground">
                  {fill(companion.filled, { filled: progress.filled, total: progress.total })}
                </p>
              )
            )}
          </div>
          <Button
            aria-label={companion.dismiss}
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setDismissed(true);
              onDismiss();
            }}
          >
            <XIcon />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
