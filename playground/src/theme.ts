/** What each side defers to while nobody has chosen — a deferral target, never a
 *  preference, so it cannot overwrite a reader's saved theme. Read by the provider
 *  and by the script that paints `<html>` before first paint, which must agree. */
export const DEFAULT_THEME = { light: "kanzo", dark: "kanzo-dark" };
