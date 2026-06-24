/** Smooth-scroll to a field by its `data-field` id, focus its first control, and
 * give it a gentle pulse. Returns whether the field was found in the DOM (false
 * when it lives on an inactive tab/step that hasn't been switched to yet). */
export function scrollToField(id: string): boolean {
  const el = document.querySelector<HTMLElement>(`[data-field="${CSS.escape(id)}"]`);
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.querySelector<HTMLElement>("input, textarea, button")?.focus();
  el.animate?.(
    [
      { boxShadow: "0 0 0 0 var(--accent-a6)" },
      { boxShadow: "0 0 0 6px var(--accent-a4)" },
      { boxShadow: "0 0 0 0 var(--accent-a6)" },
    ],
    { duration: 1000, easing: "ease-out" },
  );
  return true;
}
