import type { ComponentType, ReactElement, ReactNode } from "react";
import type { Candidate, CompletionRequest } from "../assist.js";

/**
 * The assistance UI the form draws when a `FormAssist` is wired — supplied by the
 * consumer, never imported by the core, so a form without it renders plain
 * inputs and carries no AI package. `metadata-form/ai` provides `assistUi`;
 * these are the parts of `@kanzo-tech/ai`'s two field compounds, typed by the
 * props the form passes them — among them the words they draw, which the core
 * reads from its catalog (`Strings.assist`) so the parts need know no language.
 */
export interface AssistUi {
  /** The ✨ and its candidate strip around a field (`FormAssist.suggest`). */
  suggest: {
    Root: ComponentType<{
      suggest: (signal?: AbortSignal) => AsyncIterable<Candidate>;
      existing?: string[];
      onPick: (value: string) => void;
      children: ReactNode;
    }>;
    Mark: ComponentType<{ label: string; offeringLabel: string }>;
    List: ComponentType;
  };
  /** Ghost text over a textarea (`FormAssist.complete`). */
  complete: {
    Root: ComponentType<{
      complete: (request: CompletionRequest) => AsyncIterable<string>;
      value: string;
      onValueChange: (value: string) => void;
      announcement: string;
      children: ReactNode;
    }>;
    Textarea: ComponentType<{ children: ReactElement }>;
    Hint: ComponentType<{ acceptLabel: string; dismissLabel: string }>;
  };
}
