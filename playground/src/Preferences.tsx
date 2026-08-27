import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  Field,
  FieldLabel,
  InputGroup,
  InputGroupButton,
  InputGroupInput,
  PreferencesColor,
  PreferencesDensity,
  PreferencesField,
  PreferencesFont,
  PreferencesMonoFont,
  PreferencesPanel,
  PreferencesRadius,
  PreferencesRoot,
  PreferencesTrigger,
  RadioGroup,
  RadioGroupCard,
  Switch,
} from "@kanzo-tech/ui";
import {
  Columns2Icon,
  Columns3Icon,
  EyeIcon,
  EyeOffIcon,
  GalleryVerticalIcon,
  LayoutPanelTopIcon,
  ListOrderedIcon,
  RectangleHorizontalIcon,
} from "lucide-react";
import type { FormLayout } from "metadata-form";
import { useChrome, type Chrome } from "./i18n.js";

/**
 * The playground's preferences — the reference pattern for embedding
 * metadata-form's settings in a host app.
 *
 * **The theme layer is gone from here.** This file used to carry the appearance,
 * accent, gray, panel-background, radius and scaling axes, mirroring Radix's own
 * ThemePanel and hand-syncing its value lists. The design system owns all of that
 * now: `PreferencesRoot` brings the drawer, the `p` hotkey and its typing guard,
 * `PreferencesTrigger` the FAB, and `PreferencesColor` / `Density` / `Radius` /
 * `Font` / `MonoFont` the axes themselves — applied to `<html>`, persisted, and
 * live.
 *
 * What is left is what the design system has no opinion about and should not:
 * how the *form* is laid out, whether the mascot shows, and the consumer's own
 * API key. Note that passing `children` to `PreferencesPanel` REPLACES the
 * library's sections rather than adding to them, so the theme axes below are
 * rendered explicitly and their order is ours to choose.
 */

export interface PreferencesState {
  layout: { mode: FormLayout; columns: number };
  ai: { claudeKey: string };
  assistant: { enabled: boolean };
}

export const defaultPreferences: PreferencesState = {
  layout: { mode: "sequential", columns: 1 },
  ai: { claudeKey: "" },
  assistant: { enabled: false },
};

const STORAGE_KEY = "mf_prefs";

interface PreferencesContextValue {
  prefs: PreferencesState;
  update: <K extends keyof PreferencesState>(layer: K, patch: Partial<PreferencesState[K]>) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used within <Preferences.Root>");
  return ctx;
}

function load(): PreferencesState {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<PreferencesState>;
    const layout = { ...defaultPreferences.layout, ...saved.layout };
    return {
      // A stored 4 predates the three-card control and would select no card at
      // all, so it is clamped rather than shown as an empty choice.
      layout: { ...layout, columns: Math.min(3, Math.max(1, Math.round(layout.columns) || 1)) },
      ai: { ...defaultPreferences.ai, ...saved.ai },
      assistant: { ...defaultPreferences.assistant, ...saved.assistant },
    };
  } catch {
    return defaultPreferences;
  }
}

/** Our three layers. The theme's own persistence is the provider's business, not
 *  ours — this key holds only what the design system does not know about. */
function Root({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<PreferencesState>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  const update = useCallback<PreferencesContextValue["update"]>((layer, patch) => {
    setPrefs((p) => ({ ...p, [layer]: { ...p[layer], ...patch } }));
  }, []);

  return (
    <PreferencesContext.Provider value={{ prefs, update }}>
      {/* `p`, as before — opt-in, because a design system must not claim an
          unmodified key in its host's keymap without being asked. */}
      <PreferencesRoot hotkey="p">{children}</PreferencesRoot>
    </PreferencesContext.Provider>
  );
}

/** The label is a function of the catalog rather than a string, so both axes stay
 *  one table each: the list is what a choice IS, and which language it is said in
 *  is not part of that. */
type Choice = readonly [
  value: string,
  label: (t: Chrome["prefs"]) => string,
  icon: ComponentType<{ className?: string }>,
];

const LAYOUTS: readonly Choice[] = [
  ["sequential", (t) => t.sequential, GalleryVerticalIcon],
  ["tabs", (t) => t.tabs, LayoutPanelTopIcon],
  ["steps", (t) => t.steps, ListOrderedIcon],
];

/** `FieldsGrid` writes `repeat(N, minmax(0, 1fr))` and takes any N, so three is
 *  a judgement about forms rather than a limit of the grid: past three, a label
 *  and its control stop fitting on a line at the widths this column gets with a
 *  panel open on either side. A number input said otherwise. */
const COLUMNS: readonly Choice[] = [
  ["1", (t) => t.one, RectangleHorizontalIcon],
  ["2", (t) => t.two, Columns2Icon],
  ["3", (t) => t.three, Columns3Icon],
];

/** A row of icon cards, one of which is chosen — the shape both layout axes take. */
function CardChoice({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: readonly Choice[];
  value: string;
}) {
  const t = useChrome().prefs;
  return (
    <PreferencesField label={label}>
      <RadioGroup
        aria-label={label}
        className="flex-row flex-wrap gap-2"
        value={value}
        onValueChange={(d) => d.value && onChange(d.value)}
      >
        {options.map(([v, text, Icon]) => (
          <RadioGroupCard
            key={v}
            value={v}
            className="min-w-0 flex-1 basis-20 flex-col items-center px-2 py-2"
            style={{ gap: "0.375rem" }}
          >
            <Icon className="size-4 text-muted-foreground" />
            <span className="font-medium text-xs">{text(t)}</span>
          </RadioGroupCard>
        ))}
      </RadioGroup>
    </PreferencesField>
  );
}

function LayoutSection() {
  const { prefs, update } = usePreferences();
  const t = useChrome().prefs;
  return (
    <>
      <CardChoice
        label={t.layout}
        options={LAYOUTS}
        value={prefs.layout.mode}
        onChange={(v) => update("layout", { mode: v as FormLayout })}
      />
      <CardChoice
        label={t.columns}
        options={COLUMNS}
        value={String(prefs.layout.columns)}
        onChange={(v) => update("layout", { columns: Number(v) })}
      />
    </>
  );
}

function AssistantSection() {
  const { prefs, update } = usePreferences();
  const t = useChrome().prefs;
  return (
    <Field orientation="horizontal">
      <FieldLabel className="w-fit flex-1">{t.mascot}</FieldLabel>
      <Switch
        checked={prefs.assistant.enabled}
        onCheckedChange={(d) => update("assistant", { enabled: d.checked === true })}
      />
    </Field>
  );
}

/** The consumer's own key, never the library's business — metadata-form imports
 *  no LLM SDK. Masked by default: this is a credential sitting in a panel that a
 *  screen share can be pointed at. */
function ClaudeKeySection() {
  const { prefs, update } = usePreferences();
  const [shown, setShown] = useState(false);
  const t = useChrome().prefs;
  return (
    <PreferencesField label={t.apiKey}>
      <InputGroup>
        <InputGroupInput
          type={shown ? "text" : "password"}
          placeholder="sk-ant-…"
          autoComplete="off"
          spellCheck={false}
          value={prefs.ai.claudeKey}
          onChange={(e) => update("ai", { claudeKey: e.target.value })}
        />
        <InputGroupButton
          aria-label={shown ? t.hideKey : t.showKey}
          onClick={() => setShown((s) => !s)}
        >
          {shown ? <EyeOffIcon /> : <EyeIcon />}
        </InputGroupButton>
      </InputGroup>
    </PreferencesField>
  );
}

/** The panel: colour first, then ours, then the design system's remaining axes in
 *  the order it publishes them.
 *
 *  Colour leads because it is the only light/dark control this app has, and a
 *  person hunting for one looks at the top of a settings panel. It renders
 *  nothing until the provider is given two or more `themes` — `PreferencesColor`
 *  returns null on an empty list — which is why the panel appears to start at
 *  Layout today. */
function Panel() {
  return (
    <PreferencesPanel>
      <PreferencesColor />
      <LayoutSection />
      <AssistantSection />
      <ClaudeKeySection />
      <PreferencesDensity />
      <PreferencesRadius />
      <PreferencesFont />
      <PreferencesMonoFont />
    </PreferencesPanel>
  );
}

/** Compound: Root provider + decoupled Trigger/Panel + standalone sections. */
export const Preferences = {
  Root,
  Trigger: PreferencesTrigger,
  Panel,
  Layout: LayoutSection,
  ClaudeKey: ClaudeKeySection,
  Assistant: AssistantSection,
};
