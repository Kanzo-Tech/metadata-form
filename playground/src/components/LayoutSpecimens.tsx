import type { PrefOption } from "@kanzo-tech/theme";

/** A miniature of a form: a framed sheet the parts are drawn on. */
function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <span aria-hidden className="flex h-10 w-14 flex-col gap-1 rounded-md border bg-background p-1.5">
      {children}
    </span>
  );
}

const Bar = ({ className = "" }: { className?: string }) => (
  <span className={`block h-1.5 rounded-sm bg-muted-foreground/30 ${className}`} />
);

/**
 * How each layout arranges the property groups, drawn: one after another, behind
 * tabs, or a step at a time. The card's name says it; this shows it.
 */
export function layoutSpecimen(option: PrefOption) {
  if (option.value === "tabs") {
    return (
      <Sheet>
        <span className="flex gap-0.5">
          <span className="h-1.5 w-3 rounded-sm bg-primary" />
          <span className="h-1.5 w-3 rounded-sm bg-muted-foreground/30" />
          <span className="h-1.5 w-3 rounded-sm bg-muted-foreground/30" />
        </span>
        <span className="flex-1 rounded-sm border border-dashed border-muted-foreground/30" />
      </Sheet>
    );
  }
  if (option.value === "steps") {
    return (
      <Sheet>
        <span className="flex items-center gap-0.5">
          <span className="size-1.5 rounded-full bg-primary" />
          <span className="h-px flex-1 bg-muted-foreground/30" />
          <span className="size-1.5 rounded-full bg-muted-foreground/30" />
          <span className="h-px flex-1 bg-muted-foreground/30" />
          <span className="size-1.5 rounded-full bg-muted-foreground/30" />
        </span>
        <span className="flex-1 rounded-sm border border-dashed border-muted-foreground/30" />
      </Sheet>
    );
  }
  return (
    <Sheet>
      <Bar className="w-2/3 bg-primary" />
      <Bar />
      <Bar className="w-2/3 bg-primary" />
      <Bar />
    </Sheet>
  );
}

/** Each group's fields in one, two or three columns. */
export function columnsSpecimen(option: PrefOption) {
  const n = Number(option.value);
  return (
    <Sheet>
      <span className="flex flex-1 gap-1">
        {Array.from({ length: n }, (_, i) => (
          <span className="flex flex-1 flex-col gap-1" key={i}>
            <Bar />
            <Bar />
            <Bar />
          </span>
        ))}
      </span>
    </Sheet>
  );
}

/** The form with its companion in the corner, or without it. */
export function mascotSpecimen(option: PrefOption) {
  return (
    <span aria-hidden className="relative flex h-10 w-14 flex-col gap-1 rounded-md border bg-background p-1.5">
      <Bar className="w-2/3" />
      <Bar />
      <Bar className="w-1/2" />
      {option.value === "shown" ? (
        <span className="absolute end-1 bottom-1 size-3 rounded-full bg-primary ring-2 ring-background" />
      ) : null}
    </span>
  );
}
