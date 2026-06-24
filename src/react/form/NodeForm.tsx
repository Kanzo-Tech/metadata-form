import { useEffect, useRef, useState } from "react";
import type { FormModel } from "../../core/schema/FormModel.js";
import { NodeContext, useFormContext } from "./context.js";
import { LayoutBody } from "../layout/index.js";
import { scrollToField } from "../utils/scrollToField.js";

/** Renders one FormModel (a focus node + its groups/fields) as a node scope.
 * `root` enables the layout axes (sequential/tabs/steps + grid) via `layout/`;
 * nested sub-forms always render sequentially. The root also owns the active
 * tab/step so `form.revealField` can switch to a field's group before scrolling. */
export function NodeForm({ model, root = false }: { model: FormModel; root?: boolean }) {
  const { layout, grid, report, revealTarget } = useFormContext();
  const mode = root ? (layout ?? "sequential") : "sequential";
  const [activeGroup, setActiveGroup] = useState<string>();
  const pending = useRef<string | null>(null);

  // A reveal request: switch to the group that holds the field (tabs/steps),
  // then let the scroll effect run once that group is rendered.
  useEffect(() => {
    if (!root || !revealTarget) return;
    pending.current = revealTarget.id;
    const group = model.groups.find((g) => g.fields.some((f) => f.id === revealTarget.id));
    if (group) setActiveGroup(group.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealTarget?.n]);

  // Scroll once the target is actually in the DOM. If the group is still
  // switching, the field isn't mounted yet — keep `pending` and retry when
  // `activeGroup` changes.
  useEffect(() => {
    if (!pending.current) return;
    if (scrollToField(pending.current)) pending.current = null;
  }, [activeGroup, revealTarget?.n]);

  return (
    <NodeContext.Provider value={model.focusNode}>
      <LayoutBody
        mode={mode}
        model={model}
        grid={grid}
        issues={report.issues.byGroup}
        activeGroup={activeGroup}
        onActiveGroupChange={setActiveGroup}
      />
    </NodeContext.Provider>
  );
}
