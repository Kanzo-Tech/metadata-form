import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  IconButton,
  SegmentedControl,
  Switch,
  Text,
  TextField,
  Theme,
} from "@radix-ui/themes";
import { EyeClosedIcon, EyeOpenIcon } from "@radix-ui/react-icons";
import { CloseButton } from "@/react/form/CloseButton.js";
import type { FormLayout } from "metadata-form";

/**
 * A composable preferences system for the playground — the reference pattern for
 * embedding metadata-form's settings in a host app. A Radix-style *compound
 * component* backed by a provider, with three independent layers owned by three
 * parties (Radix theme / the library's layout / the consumer's AI):
 *
 *   <Preferences.Root>
 *     <Preferences.Panel>
 *       <Preferences.Theme/><Preferences.Layout/><Preferences.Assistant/><Preferences.ClaudeKey/>
 *     </Preferences.Panel>
 *   </Preferences.Root>
 *
 * Open it with the "p" key. The Theme section mirrors Radix's own ThemePanel
 * (reusing its `rt-ThemePanel*` classes) and is extended with our layers.
 */

export type Radius = "none" | "small" | "medium" | "large" | "full";

export interface PreferencesState {
  theme: {
    appearance: "light" | "dark";
    accentColor: string;
    grayColor: string;
    panelBackground: string;
    radius: Radius;
    scaling: string;
  };
  layout: { mode: FormLayout; columns: number };
  ai: { claudeKey: string };
  assistant: { enabled: boolean };
}

export const defaultPreferences: PreferencesState = {
  theme: { appearance: "light", accentColor: "indigo", grayColor: "auto", panelBackground: "translucent", radius: "medium", scaling: "100%" },
  layout: { mode: "sequential", columns: 1 },
  ai: { claudeKey: "" },
  assistant: { enabled: false },
};

// Exact value lists from @radix-ui/themes themePropDefs (kept in sync by hand).
const ACCENTS = ["gray", "gold", "bronze", "brown", "yellow", "amber", "orange", "tomato", "red", "ruby", "crimson", "pink", "plum", "purple", "violet", "iris", "indigo", "blue", "cyan", "teal", "jade", "green", "grass", "lime", "mint", "sky"];
const GRAYS = ["auto", "gray", "mauve", "slate", "sage", "olive", "sand"];
const RADII: Radius[] = ["none", "small", "medium", "large", "full"];
const SCALINGS = ["90%", "95%", "100%", "105%", "110%"];
const PANELS = ["solid", "translucent"];
const STORAGE_KEY = "mf_prefs";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface PreferencesContextValue {
  prefs: PreferencesState;
  update: <K extends keyof PreferencesState>(layer: K, patch: Partial<PreferencesState[K]>) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
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
      theme: { ...defaultPreferences.theme, ...saved.theme },
      layout: { ...defaultPreferences.layout, ...saved.layout },
      ai: { ...defaultPreferences.ai, ...saved.ai },
      assistant: { ...defaultPreferences.assistant, ...saved.assistant },
    };
  } catch {
    return defaultPreferences;
  }
}

function PreferencesRoot({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<PreferencesState>(load);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  // "p" toggles preferences (ignored while typing); Escape closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") return setOpen(false);
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.key.toLowerCase() !== "p") return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      setOpen((v) => !v);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const update = useCallback<PreferencesContextValue["update"]>((layer, patch) => {
    setPrefs((p) => ({ ...p, [layer]: { ...p[layer], ...patch } }));
  }, []);

  const value = useMemo(() => ({ prefs, update, open, setOpen }), [prefs, update, open]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

function PreferencesTrigger() {
  const { setOpen } = usePreferences();
  return (
    <Button variant="soft" color="gray" onClick={() => setOpen(true)}>
      Preferences
    </Button>
  );
}

/** A non-modal panel pinned top-right, like Radix's own ThemePanel — applied live
 * (no overlay), slides in/out. Toggle with "p". */
function PreferencesPanel({ children }: { children: ReactNode }) {
  const { open, setOpen } = usePreferences();
  return (
    // Full-viewport clip layer: the panel slides off-screen to the right when
    // closed, and `position:fixed` is NOT clipped by `overflow:hidden` on
    // html/body — so we clip it here with an absolute child inside a fixed,
    // overflow-hidden container (pointer-events:none lets clicks pass through).
    <Box
      aria-hidden={!open}
      position="fixed"
      style={{ inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 9999 }}
    >
      <Box
        position="absolute"
        style={{
          top: "var(--space-4)",
          right: "var(--space-4)",
          pointerEvents: "auto",
          width: 380,
          maxHeight: "calc(100vh - var(--space-4) * 2)",
          overflowY: "auto",
          padding: "var(--space-5)",
          borderRadius: "var(--radius-4)",
          backgroundColor: "var(--color-panel-solid)",
          boxShadow: "var(--shadow-5)",
          transform: open ? "none" : "translateX(calc(100% + var(--space-5)))",
          transition: "transform 200ms ease",
        }}
      >
        <Flex justify="between" align="center" mb="2">
          <Heading size="4" trim="both">
            Preferences
          </Heading>
          <CloseButton label="Close preferences" onClick={() => setOpen(false)} />
        </Flex>
        <Text as="p" size="1" color="gray" mb="4">
          Applied live, saved to this browser.
        </Text>
        <Flex direction="column" gap="5">
          {children}
        </Flex>
      </Box>
    </Box>
  );
}

function GroupTitle({ children }: { children: ReactNode }) {
  return (
    <Text as="p" size="2" weight="medium" mb="3">
      {children}
    </Text>
  );
}

/** A color swatch radio, styled exactly like Radix's ThemePanel. */
function Swatch({ name, value, checked, onSelect, background, filter }: {
  name: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
  background: string;
  filter?: string;
}) {
  return (
    <label className="rt-ThemePanelSwatch" style={{ backgroundColor: background, filter }}>
      <input className="rt-ThemePanelSwatchInput" type="radio" name={name} value={value} checked={checked} onChange={onSelect} />
    </label>
  );
}

/** A radio "card" (appearance / radius / scaling / panel background), as in ThemePanel. */
function RadioCard({ name, value, checked, onSelect, children }: {
  name: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <label className="rt-ThemePanelRadioCard">
      <input className="rt-ThemePanelRadioCardInput" type="radio" name={name} value={value} checked={checked} onChange={onSelect} />
      {children}
    </label>
  );
}

/** Theme section — a faithful re-creation of Radix's ThemePanel body, driving our
 * prefs.theme. Reuses Radix's own `rt-ThemePanel*` classes for an identical look. */
function ThemeSection() {
  const { prefs, update } = usePreferences();
  const t = prefs.theme;
  const set = (patch: Partial<PreferencesState["theme"]>) => update("theme", patch);

  return (
    <Box>
      <GroupTitle>Accent color</GroupTitle>
      <Grid columns="10" gap="2" role="group" aria-label="Accent color">
        {ACCENTS.map((c) => (
          <Swatch key={c} name="accentColor" value={c} checked={t.accentColor === c} onSelect={() => set({ accentColor: c })} background={`var(--${c}-9)`} />
        ))}
      </Grid>

      <Box mt="5" />
      <GroupTitle>Gray color</GroupTitle>
      <Grid columns="10" gap="2" role="group" aria-label="Gray color">
        {GRAYS.map((g) => (
          <Swatch
            key={g}
            name="grayColor"
            value={g}
            checked={t.grayColor === g}
            onSelect={() => set({ grayColor: g })}
            background={g === "auto" ? "var(--gray-9)" : `var(--${g}-9)`}
            filter={g === "gray" ? "saturate(0)" : undefined}
          />
        ))}
      </Grid>

      <Box mt="5" />
      <GroupTitle>Appearance</GroupTitle>
      <Grid columns="2" gap="2" role="group" aria-label="Appearance">
        {(["light", "dark"] as const).map((a) => (
          <RadioCard key={a} name="appearance" value={a} checked={t.appearance === a} onSelect={() => set({ appearance: a })}>
            <Flex align="center" justify="center" height="32px" gap="2">
              {a === "light" ? <SunIcon /> : <MoonIcon />}
              <Text size="1" weight="medium">{cap(a)}</Text>
            </Flex>
          </RadioCard>
        ))}
      </Grid>

      <Box mt="5" />
      <GroupTitle>Radius</GroupTitle>
      <Grid columns="5" gap="2" role="group" aria-label="Radius">
        {RADII.map((r) => (
          <Flex key={r} direction="column" align="center">
            <RadioCard name="radius" value={r} checked={t.radius === r} onSelect={() => set({ radius: r })}>
              <Theme asChild radius={r}>
                <Box
                  m="3"
                  width="28px"
                  height="28px"
                  style={{
                    borderTopLeftRadius: r === "full" ? "80%" : "var(--radius-5)",
                    backgroundImage: "linear-gradient(to bottom right, var(--accent-3), var(--accent-4))",
                    borderTop: "2px solid var(--accent-a8)",
                    borderLeft: "2px solid var(--accent-a8)",
                  }}
                />
              </Theme>
            </RadioCard>
            <Text size="1" color="gray" mt="1">{cap(r)}</Text>
          </Flex>
        ))}
      </Grid>

      <Box mt="5" />
      <GroupTitle>Scaling</GroupTitle>
      <Grid columns="5" gap="2" role="group" aria-label="Scaling">
        {SCALINGS.map((s) => (
          <RadioCard key={s} name="scaling" value={s} checked={t.scaling === s} onSelect={() => set({ scaling: s })}>
            <Theme asChild scaling={s as never}>
              <Flex align="center" justify="center" height="32px">
                <Text size="1" weight="medium">{s}</Text>
              </Flex>
            </Theme>
          </RadioCard>
        ))}
      </Grid>

      <Box mt="5" />
      <GroupTitle>Panel background</GroupTitle>
      <Grid columns="2" gap="2" role="group" aria-label="Panel background">
        {PANELS.map((p) => (
          <RadioCard key={p} name="panelBackground" value={p} checked={t.panelBackground === p} onSelect={() => set({ panelBackground: p })}>
            <Flex align="center" justify="center" height="32px" gap="2">
              {p === "solid" ? <SolidIcon /> : <TranslucentIcon />}
              <Text size="1" weight="medium">{cap(p)}</Text>
            </Flex>
          </RadioCard>
        ))}
      </Grid>
    </Box>
  );
}

function LayoutSection() {
  const { prefs, update } = usePreferences();
  const l = prefs.layout;
  return (
    <Box>
      <GroupTitle>Form layout</GroupTitle>
      <Flex direction="column" gap="3">
        <SegmentedControl.Root value={l.mode} onValueChange={(v) => update("layout", { mode: v as FormLayout })}>
          <SegmentedControl.Item value="sequential">Sequential</SegmentedControl.Item>
          <SegmentedControl.Item value="tabs">Tabs</SegmentedControl.Item>
          <SegmentedControl.Item value="steps">Steps</SegmentedControl.Item>
        </SegmentedControl.Root>
        <SegmentedControl.Root value={String(l.columns)} onValueChange={(v) => update("layout", { columns: Number(v) })}>
          {[1, 2, 3].map((n) => (
            <SegmentedControl.Item key={n} value={String(n)}>
              {n} column{n === 1 ? "" : "s"}
            </SegmentedControl.Item>
          ))}
        </SegmentedControl.Root>
      </Flex>
    </Box>
  );
}

function ClaudeKeySection() {
  const { prefs, update } = usePreferences();
  const [reveal, setReveal] = useState(false);
  return (
    <Box>
      <GroupTitle>Claude API key</GroupTitle>
      <TextField.Root
        type={reveal ? "text" : "password"}
        placeholder="sk-ant-…"
        value={prefs.ai.claudeKey}
        onChange={(e) => update("ai", { claudeKey: e.target.value })}
      >
        <TextField.Slot side="right">
          <IconButton variant="ghost" color="gray" size="1" aria-label={reveal ? "Hide key" : "Show key"} onClick={() => setReveal((v) => !v)}>
            {reveal ? <EyeClosedIcon /> : <EyeOpenIcon />}
          </IconButton>
        </TextField.Slot>
      </TextField.Root>
      <Text as="p" size="1" color="gray" mt="1">
        Enables ✨ suggestions. Stored only in this browser.
      </Text>
    </Box>
  );
}

/* --- Icons copied from Radix's ThemePanel so the look matches exactly. --- */

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ margin: "0 -1px" }}>
      <path
        d="M7.5 0C7.77614 0 8 0.223858 8 0.5V2.5C8 2.77614 7.77614 3 7.5 3C7.22386 3 7 2.77614 7 2.5V0.5C7 0.223858 7.22386 0 7.5 0ZM2.1967 2.1967C2.39196 2.00144 2.70854 2.00144 2.90381 2.1967L4.31802 3.61091C4.51328 3.80617 4.51328 4.12276 4.31802 4.31802C4.12276 4.51328 3.80617 4.51328 3.61091 4.31802L2.1967 2.90381C2.00144 2.70854 2.00144 2.39196 2.1967 2.1967ZM0.5 7C0.223858 7 0 7.22386 0 7.5C0 7.77614 0.223858 8 0.5 8H2.5C2.77614 8 3 7.77614 3 7.5C3 7.22386 2.77614 7 2.5 7H0.5ZM2.1967 12.8033C2.00144 12.608 2.00144 12.2915 2.1967 12.0962L3.61091 10.682C3.80617 10.4867 4.12276 10.4867 4.31802 10.682C4.51328 10.8772 4.51328 11.1938 4.31802 11.3891L2.90381 12.8033C2.70854 12.9986 2.39196 12.9986 2.1967 12.8033ZM12.5 7C12.2239 7 12 7.22386 12 7.5C12 7.77614 12.2239 8 12.5 8H14.5C14.7761 8 15 7.77614 15 7.5C15 7.22386 14.7761 7 14.5 7H12.5ZM10.682 4.31802C10.4867 4.12276 10.4867 3.80617 10.682 3.61091L12.0962 2.1967C12.2915 2.00144 12.608 2.00144 12.8033 2.1967C12.9986 2.39196 12.9986 2.70854 12.8033 2.90381L11.3891 4.31802C11.1938 4.51328 10.8772 4.51328 10.682 4.31802ZM8 12.5C8 12.2239 7.77614 12 7.5 12C7.22386 12 7 12.2239 7 12.5V14.5C7 14.7761 7.22386 15 7.5 15C7.77614 15 8 14.7761 8 14.5V12.5ZM10.682 10.682C10.8772 10.4867 11.1938 10.4867 11.3891 10.682L12.8033 12.0962C12.9986 12.2915 12.9986 12.608 12.8033 12.8033C12.608 12.9986 12.2915 12.9986 12.0962 12.8033L10.682 11.3891C10.4867 11.1938 10.4867 10.8772 10.682 10.682ZM5.5 7.5C5.5 6.39543 6.39543 5.5 7.5 5.5C8.60457 5.5 9.5 6.39543 9.5 7.5C9.5 8.60457 8.60457 9.5 7.5 9.5C6.39543 9.5 5.5 8.60457 5.5 7.5ZM7.5 4.5C5.84315 4.5 4.5 5.84315 4.5 7.5C4.5 9.15685 5.84315 10.5 7.5 10.5C9.15685 10.5 10.5 9.15685 10.5 7.5C10.5 5.84315 9.15685 4.5 7.5 4.5Z"
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ margin: "0 -1px" }}>
      <path
        d="M2.89998 0.499976C2.89998 0.279062 2.72089 0.0999756 2.49998 0.0999756C2.27906 0.0999756 2.09998 0.279062 2.09998 0.499976V1.09998H1.49998C1.27906 1.09998 1.09998 1.27906 1.09998 1.49998C1.09998 1.72089 1.27906 1.89998 1.49998 1.89998H2.09998V2.49998C2.09998 2.72089 2.27906 2.89998 2.49998 2.89998C2.72089 2.89998 2.89998 2.72089 2.89998 2.49998V1.89998H3.49998C3.72089 1.89998 3.89998 1.72089 3.89998 1.49998C3.89998 1.27906 3.72089 1.09998 3.49998 1.09998H2.89998V0.499976ZM5.89998 3.49998C5.89998 3.27906 5.72089 3.09998 5.49998 3.09998C5.27906 3.09998 5.09998 3.27906 5.09998 3.49998V4.09998H4.49998C4.27906 4.09998 4.09998 4.27906 4.09998 4.49998C4.09998 4.72089 4.27906 4.89998 4.49998 4.89998H5.09998V5.49998C5.09998 5.72089 5.27906 5.89998 5.49998 5.89998C5.72089 5.89998 5.89998 5.72089 5.89998 5.49998V4.89998H6.49998C6.72089 4.89998 6.89998 4.72089 6.89998 4.49998C6.89998 4.27906 6.72089 4.09998 6.49998 4.09998H5.89998V3.49998ZM1.89998 6.49998C1.89998 6.27906 1.72089 6.09998 1.49998 6.09998C1.27906 6.09998 1.09998 6.27906 1.09998 6.49998V7.09998H0.499976C0.279062 7.09998 0.0999756 7.27906 0.0999756 7.49998C0.0999756 7.72089 0.279062 7.89998 0.499976 7.89998H1.09998V8.49998C1.09998 8.72089 1.27906 8.89997 1.49998 8.89997C1.72089 8.89997 1.89998 8.72089 1.89998 8.49998V7.89998H2.49998C2.72089 7.89998 2.89998 7.72089 2.89998 7.49998C2.89998 7.27906 2.72089 7.09998 2.49998 7.09998H1.89998V6.49998ZM8.54406 0.98184L8.24618 0.941586C8.03275 0.917676 7.90692 1.1655 8.02936 1.34194C8.17013 1.54479 8.29981 1.75592 8.41754 1.97445C8.91878 2.90485 9.20322 3.96932 9.20322 5.10022C9.20322 8.37201 6.82247 11.0878 3.69887 11.6097C3.45736 11.65 3.20988 11.6772 2.96008 11.6906C2.74563 11.702 2.62729 11.9535 2.77721 12.1072C2.84551 12.1773 2.91535 12.2458 2.98667 12.3128L3.05883 12.3795L3.31883 12.6045L3.50684 12.7532L3.62796 12.8433L3.81491 12.9742L3.99079 13.089C4.11175 13.1651 4.23536 13.2375 4.36157 13.3059L4.62496 13.4412L4.88553 13.5607L5.18837 13.6828L5.43169 13.7686C5.56564 13.8128 5.70149 13.8529 5.83857 13.8885C5.94262 13.9155 6.04767 13.9401 6.15405 13.9622C6.27993 13.9883 6.40713 14.0109 6.53544 14.0298L6.85241 14.0685L7.11934 14.0892C7.24637 14.0965 7.37436 14.1002 7.50322 14.1002C11.1483 14.1002 14.1032 11.1453 14.1032 7.50023C14.1032 7.25044 14.0893 7.00389 14.0623 6.76131L14.0255 6.48407C13.991 6.26083 13.9453 6.04129 13.8891 5.82642C13.8213 5.56709 13.7382 5.31398 13.6409 5.06881L13.5279 4.80132L13.4507 4.63542L13.3766 4.48666C13.2178 4.17773 13.0353 3.88295 12.8312 3.60423L12.6782 3.40352L12.4793 3.16432L12.3157 2.98361L12.1961 2.85951L12.0355 2.70246L11.8134 2.50184L11.4925 2.24191L11.2483 2.06498L10.9562 1.87446L10.6346 1.68894L10.3073 1.52378L10.1938 1.47176L9.95488 1.3706L9.67791 1.2669L9.42566 1.1846L9.10075 1.09489L8.83599 1.03486L8.54406 0.98184ZM10.4032 5.30023C10.4032 4.27588 10.2002 3.29829 9.83244 2.40604C11.7623 3.28995 13.1032 5.23862 13.1032 7.50023C13.1032 10.593 10.596 13.1002 7.50322 13.1002C6.63646 13.1002 5.81597 12.9036 5.08355 12.5522C6.5419 12.0941 7.81081 11.2082 8.74322 10.0416C8.87963 10.2284 9.10028 10.3497 9.34928 10.3497C9.76349 10.3497 10.0993 10.0139 10.0993 9.59971C10.0993 9.24256 9.84965 8.94373 9.51535 8.86816C9.57741 8.75165 9.63653 8.63334 9.6926 8.51332C9.88358 8.63163 10.1088 8.69993 10.35 8.69993C11.0403 8.69993 11.6 8.14028 11.6 7.44993C11.6 6.75976 11.0406 6.20024 10.3505 6.19993C10.3853 5.90487 10.4032 5.60464 10.4032 5.30023Z"
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </svg>
  );
}

function SolidIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ margin: "0 -2px" }}>
      <path
        d="M0.877075 7.49988C0.877075 3.84219 3.84222 0.877045 7.49991 0.877045C11.1576 0.877045 14.1227 3.84219 14.1227 7.49988C14.1227 11.1575 11.1576 14.1227 7.49991 14.1227C3.84222 14.1227 0.877075 11.1575 0.877075 7.49988ZM7.49991 1.82704C4.36689 1.82704 1.82708 4.36686 1.82708 7.49988C1.82708 10.6329 4.36689 13.1727 7.49991 13.1727C10.6329 13.1727 13.1727 10.6329 13.1727 7.49988C13.1727 4.36686 10.6329 1.82704 7.49991 1.82704Z"
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </svg>
  );
}

function TranslucentIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ margin: "0 -2px" }}>
      <path d="M7.5 0.877075C3.83209 0.877075 0.877075 3.83209 0.877075 7.5C0.877075 11.1679 3.83209 14.1229 7.5 14.1229C11.1679 14.1229 14.1229 11.1679 14.1229 7.5C14.1229 3.83209 11.1679 0.877075 7.5 0.877075ZM1.82707 7.5C1.82707 4.35986 4.35986 1.82707 7.5 1.82707V13.1729C4.35986 13.1729 1.82707 10.6401 1.82707 7.5Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
    </svg>
  );
}

function AssistantSection() {
  const { prefs, update } = usePreferences();
  return (
    <Box>
      <GroupTitle>Assistant</GroupTitle>
      <Text as="label" size="2" color="gray">
        <Flex align="center" gap="2">
          <Switch checked={prefs.assistant.enabled} onCheckedChange={(v) => update("assistant", { enabled: v })} />
          Show the mascot companion
        </Flex>
      </Text>
    </Box>
  );
}

/** Compound: Root provider + decoupled Trigger/Panel + standalone sections. */
export const Preferences = {
  Root: PreferencesRoot,
  Trigger: PreferencesTrigger,
  Panel: PreferencesPanel,
  Theme: ThemeSection,
  Layout: LayoutSection,
  ClaudeKey: ClaudeKeySection,
  Assistant: AssistantSection,
};
