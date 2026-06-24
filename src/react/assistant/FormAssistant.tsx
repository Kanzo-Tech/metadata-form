import { useState } from "react";
import { Box, Card, Flex, Text } from "@radix-ui/themes";
import type { MetadataFormController } from "../hooks/useMetadataForm.js";
import { CloseButton } from "../form/CloseButton.js";
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

  const pos = corner === "bottom-left" ? { left: "var(--space-5)" } : { right: "var(--space-5)" };

  return (
    <Box position="fixed" style={{ bottom: "var(--space-5)", ...pos, zIndex: 50 }}>
      <Card
        role={actionable ? "button" : undefined}
        tabIndex={actionable ? 0 : undefined}
        onClick={actionable ? onActivate : undefined}
        onKeyDown={(e) => actionable && (e.key === "Enter" || e.key === " ") && onActivate()}
        style={{ maxWidth: 280, cursor: actionable ? "pointer" : "default" }}
      >
        <Flex align="center" gap="3">
          <Character mood={health.mood} size={44} />
          <Flex direction="column" gap="1" style={{ minWidth: 0 }}>
            <Text size="2" weight="medium">
              {health.message}
            </Text>
            {actionable ? (
              <Text size="1" color="gray">
                Next: {nextField!.label} →
              </Text>
            ) : (
              progress.total > 0 && (
                <Text size="1" color="gray">
                  {progress.filled}/{progress.total} filled
                </Text>
              )
            )}
          </Flex>
          <CloseButton
            label="Dismiss assistant"
            onClick={(e) => {
              e.stopPropagation();
              setDismissed(true);
              onDismiss?.();
            }}
          />
        </Flex>
      </Card>
    </Box>
  );
}
