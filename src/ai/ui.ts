import {
  CompleteHint,
  CompleteRoot,
  CompleteTextarea,
  SuggestList,
  SuggestMark,
  SuggestRoot,
} from "@kanzo-tech/ai";
import type { AssistUi } from "../react/assistUi.js";

/**
 * The assistance UI, from `@kanzo-tech/ai`'s two field compounds — hand it to the
 * form and a wired `assist` gets its ✨ and its ghost text:
 *
 *   <MetadataForm form={form} assistUi={assistUi} />
 *
 * The compounds are used as published; `AssistUi` only names the parts the form
 * composes. Its `Candidate` is structurally `@kanzo-tech/ai`'s own, which this
 * assignment checks in the direction the form relies on.
 */
export const assistUi: AssistUi = {
  suggest: { Root: SuggestRoot, Mark: SuggestMark, List: SuggestList },
  complete: { Root: CompleteRoot, Textarea: CompleteTextarea, Hint: CompleteHint },
};
