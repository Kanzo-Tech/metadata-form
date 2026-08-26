import { useState } from "react";
import { Button, Card, CardContent } from "@kanzo-tech/ui";
import { XIcon } from "lucide-react";
import type { MetadataFormController } from "../hooks/useMetadataForm.js";
import { defaultMascot, type MascotCharacter } from "./mascot.js";
import { column, ink, row } from "../styles.js";

export interface FormAssistantProps {
  form: MetadataFormController;
  /** The mascot body. Defaults to the built-in emoji character; swap for Lottie/Rive. */
  character?: MascotCharacter;
  /** Where the companion floats. Defaults to bottom-right. */
  corner?: "bottom-right" | "bottom-left";
  /** Called when the user closes the companion (the ✕). Wire this to your own
   * "show assistant" setting so the toggle stays in sync with the close button. */
  onDismiss?: () => void;
}

/**
 * The assistant's *body*: a small, non-intrusive corner companion. It reads the
 * controller's `form.report` (health + completion + next pending field) and
 * renders the mascot + a speech bubble; clicking gently guides to the next
 * required field (scroll + focus + a soft pulse — never a spotlight overlay).
 * The mascot is swappable via `character`.
 */
export function FormAssistant({ form, character = defaultMascot, corner = "bottom-right", onDismiss }: FormAssistantProps) {
  const { health, progress, nextField } = form.report;
  const [dismissed, setDismissed] = useState(false);
  const Character = character;

  if (dismissed) return null;

  const actionable = !!nextField;
  const onActivate = () => {
    // Route through the controller so it can switch to the field's tab/step
    // before scrolling — works even when the field is on an inactive section.
    if (nextField) form.revealField(nextField.id);
  };

  return (
    // Inline, not utilities: `bottom-6`, `left-6`, `right-6` and `max-w-70` are not
    // in @kanzo-tech/ui's stylesheet — it ships the utilities ITS components use,
    // and nothing here generates more. A class that is not in the sheet is a
    // silent no-op in a consumer's app.
    <div
      style={{
        position: "fixed",
        zIndex: 50,
        bottom: "1.5rem",
        [corner === "bottom-left" ? "left" : "right"]: "1.5rem",
      }}
    >
      <Card
        style={{ maxWidth: "17.5rem", cursor: actionable ? "pointer" : undefined }}
        role={actionable ? "button" : undefined}
        tabIndex={actionable ? 0 : undefined}
        onClick={actionable ? onActivate : undefined}
        onKeyDown={(e) => actionable && (e.key === "Enter" || e.key === " ") && onActivate()}
      >
        <CardContent style={{ ...row, gap: "0.75rem" }}>
          <Character mood={health.mood} size={44} />
          <div style={{ ...column, gap: "0.25rem", minWidth: 0 }}>
            <p style={{ fontWeight: 500, fontSize: "0.875rem" }}>{health.message}</p>
            {actionable ? (
              <p style={{ color: ink.muted, fontSize: "0.75rem" }}>Next: {nextField!.label} →</p>
            ) : (
              progress.total > 0 && (
                <p style={{ color: ink.muted, fontSize: "0.75rem" }}>
                  {progress.filled}/{progress.total} filled
                </p>
              )
            )}
          </div>
          <Button
            aria-label="Dismiss assistant"
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setDismissed(true);
              onDismiss?.();
            }}
          >
            <XIcon />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
