import { useState, useSyncExternalStore } from "react";
import {
  InputGroup,
  InputGroupButton,
  InputGroupInput,
  PreferencesField,
  PreferencesPanel,
  PreferencesSections,
  useKanzoTheme,
} from "@kanzo-tech/ui";
import type { SectionManifest } from "@kanzo-tech/theme";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import type { FormLayout, GridLayout } from "metadata-form";
import { useChrome } from "./i18n.js";
import { columnsSpecimen, layoutSpecimen, mascotSpecimen } from "./components/LayoutSpecimens.js";

/**
 * The playground's preferences.
 *
 * **Everything the design system can hold, it holds.** How the *form* is laid out
 * and whether the mascot shows are a `SectionManifest` — the mechanism an optional
 * package uses to contribute a choice — registered on the theme provider. So they
 * are drawn by `PreferencesSections` in the panel's own language, resolved through
 * the same chain as appearance and density (a tenant could pin them), and persisted
 * beside them; this file keeps no store of its own for them.
 *
 * What is left is the consumer's own API key. A section has three kinds — choice,
 * toggle, range — and by design no text field, and a credential is not a choice
 * anyway: it stays here, in its own storage key, masked.
 *
 * Passing `children` to `PreferencesPanel` replaces what it draws, so the sections
 * are named explicitly below — all of them, the theme's included.
 */

const NAMESPACE = "playground";

export const PLAYGROUND_SECTION: SectionManifest = {
  namespace: NAMESPACE,
  version: 1,
  prefs: {
    layout: {
      kind: "choice",
      label: "Layout",
      default: "sequential",
      doc: "How the property groups are arranged.",
      options: [
        { value: "sequential", label: "Sequential" },
        { value: "tabs", label: "Tabs" },
        { value: "steps", label: "Steps" },
      ],
    },
    // `FieldGroup` takes one to four columns, so three is a judgement about forms
    // rather than a limit of the grid: past three, a label and its control stop
    // fitting on a line at the widths this column gets with a panel open on either
    // side.
    columns: {
      kind: "choice",
      label: "Columns",
      default: "1",
      doc: "How many columns each group's fields are laid out in.",
      options: [
        { value: "1", label: "One" },
        { value: "2", label: "Two" },
        { value: "3", label: "Three" },
      ],
    },
    // A choice and not a toggle, so it is drawn as the other two are: a card that
    // shows what it does, rather than a switch under a sentence.
    mascot: {
      kind: "choice",
      label: "Companion",
      default: "hidden",
      doc: "The corner companion that reads the form's health.",
      options: [
        { value: "hidden", label: "Hidden" },
        { value: "shown", label: "Shown" },
      ],
    },
  },
};

/** The form's layout preferences, as the props `MetadataForm` takes. */
export function useLayoutPrefs(): { layout: FormLayout; columns: NonNullable<GridLayout["columns"]> } {
  const { sectionPrefs } = useKanzoTheme();
  const prefs = sectionPrefs[NAMESPACE];
  return {
    layout: (prefs?.layout?.value ?? "sequential") as FormLayout,
    columns: Number(prefs?.columns?.value ?? 1) as NonNullable<GridLayout["columns"]>,
  };
}

/** Whether the mascot shows, and how to put it away. */
export function useMascot(): [boolean, (on: boolean) => void] {
  const { sectionPrefs, setSectionPref } = useKanzoTheme();
  const shown = sectionPrefs[NAMESPACE]?.mascot?.value === "shown";
  return [shown, (on) => setSectionPref(NAMESPACE, { mascot: on ? "shown" : "hidden" })];
}

const KEY_STORAGE = "mf_claude_key";
const MODEL_STORAGE = "mf_claude_model";
const listeners = new Set<() => void>();

/** What the model is called until the reader names another. A model id is the
 *  consumer's to choose, so it is a preference and the call site names none. */
export const DEFAULT_MODEL = "claude-sonnet-5-5";

/** A string kept in `localStorage`, read by every component that shows it. */
function useStored(storageKey: string, fallback = ""): [string, (value: string) => void] {
  const value = useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    () => localStorage.getItem(storageKey) ?? fallback,
  );
  return [
    value,
    (next) => {
      localStorage.setItem(storageKey, next);
      listeners.forEach((notify) => notify());
    },
  ];
}

/** The consumer's own key, never the library's business — metadata-form imports
 *  no LLM SDK. */
export const useClaudeKey = () => useStored(KEY_STORAGE);

/** The model the assistance calls; a blank field means {@link DEFAULT_MODEL}. */
export function useClaudeModel(): [string, (model: string) => void] {
  const [model, setModel] = useStored(MODEL_STORAGE, DEFAULT_MODEL);
  return [model.trim() || DEFAULT_MODEL, setModel];
}

/** Masked by default: this is a credential sitting in a panel that a screen share
 *  can be pointed at. */
function ClaudeKeySection() {
  const [key, setKey] = useClaudeKey();
  const [model, setModel] = useClaudeModel();
  const [shown, setShown] = useState(false);
  const t = useChrome().prefs;
  return (
    <>
      <PreferencesField label={t.model}>
        <InputGroup>
          <InputGroupInput autoComplete="off" spellCheck={false} value={model} onChange={(e) => setModel(e.target.value)} />
        </InputGroup>
      </PreferencesField>
      <PreferencesField label={t.apiKey}>
        <InputGroup>
          <InputGroupInput
            type={shown ? "text" : "password"}
            placeholder="sk-ant-…"
            autoComplete="off"
            spellCheck={false}
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <InputGroupButton aria-label={shown ? t.hideKey : t.showKey} onClick={() => setShown((s) => !s)}>
            {shown ? <EyeOffIcon /> : <EyeIcon />}
          </InputGroupButton>
        </InputGroup>
      </PreferencesField>
    </>
  );
}

/** How the form's own choices look, drawn as density's are. */
const SPECIMENS = {
  [`${NAMESPACE}.layout`]: layoutSpecimen,
  [`${NAMESPACE}.columns`]: columnsSpecimen,
  [`${NAMESPACE}.mascot`]: mascotSpecimen,
};

/** The panel: every section — the theme's (appearance, the theme per side,
 *  density) and this app's — then the key, which is not a preference at all. */
export function PreferencesPanelContent() {
  return (
    <PreferencesPanel>
      <PreferencesSections specimens={SPECIMENS} />
      <ClaudeKeySection />
    </PreferencesPanel>
  );
}
