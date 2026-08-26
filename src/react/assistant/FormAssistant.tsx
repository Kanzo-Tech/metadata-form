import { useState } from "react";
import { Button, Card, CardContent } from "@kanzo-tech/ui";
import { XIcon } from "lucide-react";
import type { MetadataFormController } from "../hooks/useMetadataForm.js";
import { defaultMascot, type MascotCharacter } from "./mascot.js";

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
    <div
      className={`fixed bottom-6 z-50 ${corner === "bottom-left" ? "left-6" : "right-6"}`}
    >
      <Card
        className={`max-w-70 ${actionable ? "cursor-pointer" : ""}`}
        role={actionable ? "button" : undefined}
        tabIndex={actionable ? 0 : undefined}
        onClick={actionable ? onActivate : undefined}
        onKeyDown={(e) => actionable && (e.key === "Enter" || e.key === " ") && onActivate()}
      >
        <CardContent className="flex items-center gap-3">
          <Character mood={health.mood} size={44} />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="font-medium text-sm">{health.message}</p>
            {actionable ? (
              <p className="text-muted-foreground text-xs">Next: {nextField!.label} →</p>
            ) : (
              progress.total > 0 && (
                <p className="text-muted-foreground text-xs">
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
