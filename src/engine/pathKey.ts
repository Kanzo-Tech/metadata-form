import type { PathExpr } from "../model/ShapeIR.js";

/**
 * A canonical, stable string for a {@link PathExpr}, used to key a property's
 * projected values back to its property shape. Mirrors SPARQL property-path
 * surface syntax: `^p`, `(a/b)`, `(a|b)`, `p*`, `p+`, `p?`.
 */
export function pathKey(path: PathExpr): string {
  switch (path.kind) {
    case "predicate":
      return path.iri;
    case "inverse":
      return `^${pathKey(path.of)}`;
    case "sequence":
      return `(${path.steps.map(pathKey).join("/")})`;
    case "alternative":
      return `(${path.options.map(pathKey).join("|")})`;
    case "zeroOrMore":
      return `${pathKey(path.path)}*`;
    case "oneOrMore":
      return `${pathKey(path.path)}+`;
    case "zeroOrOne":
      return `${pathKey(path.path)}?`;
  }
}
