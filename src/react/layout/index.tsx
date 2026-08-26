import type { FormModel } from "../../form/FormModel.js";
import type { FormLayout, GridLayout } from "../form/context.js";
import type { GroupIssues } from "../validation/useFormReport.js";
import { SequentialLayout } from "./SequentialLayout.js";
import { TabsLayout } from "./TabsLayout.js";
import { StepsLayout } from "./StepsLayout.js";

/** Routes a root form model to its layout (Eje A). Nested sub-forms always use
 * `sequential`. Per-group validation badges come from `form.report.issues.byGroup`.
 * `activeGroup`/`onActiveGroupChange` make tabs/steps controllable so the active
 * section can be switched programmatically (e.g. by `form.revealField`). */
export function LayoutBody({
  mode,
  model,
  grid,
  issues,
  activeGroup,
  onActiveGroupChange,
}: {
  mode: FormLayout;
  model: FormModel;
  grid?: GridLayout;
  issues: Map<string, GroupIssues>;
  activeGroup?: string;
  onActiveGroupChange?: (groupId: string) => void;
}) {
  if (mode === "tabs")
    return <TabsLayout model={model} grid={grid} issues={issues} activeGroup={activeGroup} onActiveGroupChange={onActiveGroupChange} />;
  if (mode === "steps")
    return <StepsLayout model={model} grid={grid} issues={issues} activeGroup={activeGroup} onActiveGroupChange={onActiveGroupChange} />;
  return <SequentialLayout model={model} grid={grid} issues={issues} />;
}
