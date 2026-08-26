import { Fragment, type ReactNode } from "react";
import { Resizable, ResizablePanel, ResizableResizeTrigger } from "@kanzo-tech/ui";

/** One column of the workspace: what it is, what it renders, and how far it may be squeezed. */
export interface WorkspaceColumn {
  id: string;
  /** Percent of the row this column may not go below. */
  minSize: number;
  node: ReactNode;
}

/**
 * The workspace row: panels beside the form, every seam draggable.
 *
 * This replaces a hand-written aside + resize handle + width state. The drag
 * behaviour, the keyboard resizing and the ARIA come from the machine, so none of
 * it is ours to keep correct — and the widths stop being React state, which is why
 * `usePanels` now tracks only whether a panel is shown.
 *
 * Two things decided here rather than by the caller. **One column is not a
 * workspace**: with nothing to resize against, the splitter is dead chrome and the
 * single column is returned bare. And the **`key` is the open set**, because the
 * splitter builds its panel model once — a column appearing or leaving without a
 * new key leaves the model describing a row that is no longer there, and the drag
 * resizes the wrong seam.
 */
export function WorkspaceColumns({
  columns,
  defaultSize,
}: {
  columns: WorkspaceColumn[];
  defaultSize: number[];
}) {
  if (columns.length === 1) return columns[0]?.node ?? null;

  return (
    <Resizable
      defaultSize={defaultSize}
      key={columns.map((c) => c.id).join("-")}
      panels={columns.map(({ id, minSize }) => ({ id, minSize }))}
    >
      {columns.map((column, i) => (
        <Fragment key={column.id}>
          {i > 0 ? (
            <ResizableResizeTrigger id={`${columns[i - 1]?.id}:${column.id}`} withHandle />
          ) : null}
          <ResizablePanel className="flex min-w-0 flex-col overflow-hidden" id={column.id}>
            {column.node}
          </ResizablePanel>
        </Fragment>
      ))}
    </Resizable>
  );
}
