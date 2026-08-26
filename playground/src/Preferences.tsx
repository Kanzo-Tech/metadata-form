import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  Field,
  FieldLabel,
  Input,
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
  EyeIcon,
  EyeOffIcon,
  GalleryVerticalIcon,
  LayoutPanelTopIcon,
  ListOrderedIcon,
} from "lucide-react";
import type { FormLayout } from "metadata-form";

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
    return {
      layout: { ...defaultPreferences.layout, ...saved.layout },
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

const LAYOUTS = [
  ["sequential", "Sequential", GalleryVerticalIcon],
  ["tabs", "Tabs", LayoutPanelTopIcon],
  ["steps", "Steps", ListOrderedIcon],
] as const;

function LayoutSection() {
  const { prefs, update } = usePreferences();
  return (
    <>
      <PreferencesField label="Layout">
        <RadioGroup
          aria-label="Form layout"
          className="flex-row flex-wrap gap-2"
          value={prefs.layout.mode}
          onValueChange={(d) => d.value && update("layout", { mode: d.value as FormLayout })}
        >
          {LAYOUTS.map(([value, label, Icon]) => (
            <RadioGroupCard
              key={value}
              value={value}
              className="min-w-0 flex-1 basis-16 flex-col items-center gap-1.5 px-2 py-2"
            >
              <Icon className="size-4 text-muted-foreground" />
              <span className="font-medium text-xs">{label}</span>
            </RadioGroupCard>
          ))}
        </RadioGroup>
      </PreferencesField>
      <PreferencesField label="Columns">
        <Input
          type="number"
          min={1}
          max={4}
          value={prefs.layout.columns}
          onChange={(e) => update("layout", { columns: Math.max(1, Number(e.target.value) || 1) })}
        />
      </PreferencesField>
    </>
  );
}

function AssistantSection() {
  const { prefs, update } = usePreferences();
  return (
    <Field orientation="horizontal">
      <FieldLabel className="w-fit flex-1">Show the mascot companion</FieldLabel>
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
  return (
    <PreferencesField label="Anthropic API key">
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
          aria-label={shown ? "Hide the key" : "Show the key"}
          onClick={() => setShown((s) => !s)}
        >
          {shown ? <EyeOffIcon /> : <EyeIcon />}
        </InputGroupButton>
      </InputGroup>
    </PreferencesField>
  );
}

/** The panel: ours first — they are what this screen is about — then the design
 *  system's own axes, in the order it publishes them. */
function Panel() {
  return (
    <PreferencesPanel>
      <LayoutSection />
      <AssistantSection />
      <ClaudeKeySection />
      <PreferencesColor />
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
