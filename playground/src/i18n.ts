import { createContext, useContext } from "react";

/**
 * The playground's own words, in the three languages the shapes speak.
 *
 * **Deliberately not `metadata-form`'s catalog, and the line is what each string
 * names.** `src/i18n/strings.ts` covers the FORM — the language picker's chrome
 * and the wording of a finding — which every consumer renders and therefore every
 * consumer needs translated. What is below names *this workspace's furniture*: a
 * Source pane, an activity rail, a Share button, a mascot toggle. A library that
 * shipped vocabulary for a workspace its consumers do not have would be asking
 * them to carry ours. So the playground is a consumer here like any other, and it
 * carries its own catalog.
 *
 * What IS shared is the input: the same `locale` the form is given picks this
 * catalog, so the pane header and the message inside it can never disagree about
 * which language this is.
 */
export interface Chrome {
  /** Under the wordmark, on wide viewports. */
  tagline: string;
  /** Beside the `P` key hint in the header. */
  preferences: string;
  /** Accessible name of the UI-language select. */
  language: string;
  share: {
    idle: string;
    copied: string;
    /** The clipboard was unavailable, so the URL is only in the address bar. */
    uncopied: string;
    /** Title of the button in that state. */
    unavailable: string;
  };
  panes: {
    /** Accessible name of the activity rail. */
    rail: string;
    source: string;
    issues: string;
    output: string;
    /** What each rail switch opens, after the pane's name. */
    sourceHint: string;
    issuesHint: string;
    outputHint: string;
    /** `{pane}` — accessible name of a pane's close button. */
    close: string;
  };
  source: {
    shapeTab: string;
    dataTab: string;
    /** Accessible names of the two pickers, which have no visible label. */
    shapePicker: string;
    dataPicker: string;
  };
  issues: {
    /** The pane header's detail when the report is clean. */
    clean: string;
    /** `{blocking}`, `{total}` — the detail when it is not. */
    blocking: string;
  };
  output: {
    /** Accessible name of the format select. */
    which: string;
    /** `{format}` — accessible name of the download button. */
    download: string;
  };
  notice: {
    truncatedTitle: string;
    truncatedDetail: string;
    /** `{id}` — the shape set the link named. */
    unknownTitle: string;
    unknownDetail: string;
    dismiss: string;
  };
  prefs: {
    apiKey: string;
    showKey: string;
    hideKey: string;
  };
  /** The corner companion's lines: one per `report.health` mood, then its footer. */
  companion: {
    /** `{n}` violations. */
    warning: string;
    /** `{n}` required fields left. */
    guiding: string;
    celebrating: string;
    idle: string;
    /** `{field}` is the next required field's label. */
    next: string;
    /** `{filled}` of `{total}`. */
    filled: string;
    dismiss: string;
  };
}

const EN: Chrome = {
  tagline: "SHACL shapes → editable RDF form → Turtle & JSON-LD",
  preferences: "Preferences",
  language: "Language",
  share: {
    idle: "Share",
    copied: "Copied!",
    uncopied: "In the address bar",
    unavailable: "The clipboard is unavailable here — copy the URL from the address bar",
  },
  panes: {
    rail: "Panels",
    source: "Source",
    issues: "Issues",
    output: "Output",
    sourceHint: "the shapes and the data",
    issuesHint: "what validation found",
    outputHint: "Turtle and JSON-LD",
    close: "Close {pane}",
  },
  source: {
    shapeTab: "SHACL shape",
    dataTab: "Data graph",
    shapePicker: "Shape",
    dataPicker: "Data",
  },
  issues: {
    clean: "Nothing found",
    blocking: "{blocking} blocking of {total}",
  },
  output: {
    which: "Which output",
    download: "Download the {format}",
  },
  notice: {
    truncatedTitle: "That link did not survive the trip",
    truncatedDetail:
      "The address carried a permalink we could not read — most likely truncated on the way here. Ask for it again, or start from an example below.",
    unknownTitle: "This deployment does not ship “{id}”",
    unknownDetail:
      "The link names a shape set by id, which only resolves where that shape set is installed. Ask the sender for a link with the shapes embedded.",
    dismiss: "Dismiss",
  },
  prefs: {
    apiKey: "Anthropic API key",
    showKey: "Show the key",
    hideKey: "Hide the key",
  },
  companion: {
    warning: "Things to fix: {n}",
    guiding: "Required fields left: {n}",
    celebrating: "All set — looks complete!",
    idle: "Let's fill this in",
    next: "Next: {field} →",
    filled: "{filled}/{total} filled",
    dismiss: "Dismiss assistant",
  },
};

const ES: Chrome = {
  tagline: "Formas SHACL → formulario RDF editable → Turtle y JSON-LD",
  preferences: "Preferencias",
  language: "Idioma",
  share: {
    idle: "Compartir",
    copied: "¡Copiado!",
    uncopied: "En la barra de direcciones",
    unavailable: "Aquí no hay portapapeles — copia la URL de la barra de direcciones",
  },
  panes: {
    rail: "Paneles",
    source: "Fuente",
    issues: "Incidencias",
    output: "Salida",
    sourceHint: "las formas y los datos",
    issuesHint: "lo que encontró la validación",
    outputHint: "Turtle y JSON-LD",
    close: "Cerrar {pane}",
  },
  source: {
    shapeTab: "Forma SHACL",
    dataTab: "Grafo de datos",
    shapePicker: "Forma",
    dataPicker: "Datos",
  },
  issues: {
    clean: "Sin incidencias",
    blocking: "bloqueantes: {blocking} de {total}",
  },
  output: {
    which: "Qué salida",
    download: "Descargar el {format}",
  },
  notice: {
    truncatedTitle: "Ese enlace no llegó entero",
    truncatedDetail:
      "La dirección traía un permalink que no pudimos leer — lo más probable es que se truncara por el camino. Pídelo de nuevo o empieza por uno de los ejemplos.",
    unknownTitle: "Este despliegue no incluye «{id}»",
    unknownDetail:
      "El enlace nombra un conjunto de formas por su id, y eso solo se resuelve donde ese conjunto está instalado. Pide a quien lo envió un enlace con las formas incrustadas.",
    dismiss: "Descartar",
  },
  prefs: {
    apiKey: "Clave de API de Anthropic",
    showKey: "Mostrar la clave",
    hideKey: "Ocultar la clave",
  },
  companion: {
    warning: "Cosas por corregir: {n}",
    guiding: "Campos obligatorios pendientes: {n}",
    celebrating: "¡Todo listo, parece completo!",
    idle: "Vamos a rellenarlo",
    next: "Siguiente: {field} →",
    filled: "{filled}/{total} rellenados",
    dismiss: "Cerrar el asistente",
  },
};

const CA: Chrome = {
  tagline: "Formes SHACL → formulari RDF editable → Turtle i JSON-LD",
  preferences: "Preferències",
  language: "Idioma",
  share: {
    idle: "Comparteix",
    copied: "Copiat!",
    uncopied: "A la barra d'adreces",
    unavailable: "Aquí no hi ha porta-retalls — copia l'URL de la barra d'adreces",
  },
  panes: {
    rail: "Panells",
    source: "Font",
    issues: "Incidències",
    output: "Sortida",
    sourceHint: "les formes i les dades",
    issuesHint: "què ha trobat la validació",
    outputHint: "Turtle i JSON-LD",
    close: "Tanca {pane}",
  },
  source: {
    shapeTab: "Forma SHACL",
    dataTab: "Graf de dades",
    shapePicker: "Forma",
    dataPicker: "Dades",
  },
  issues: {
    clean: "Sense incidències",
    blocking: "bloquejants: {blocking} de {total}",
  },
  output: {
    which: "Quina sortida",
    download: "Descarrega el {format}",
  },
  notice: {
    truncatedTitle: "Aquest enllaç no ha arribat sencer",
    truncatedDetail:
      "L'adreça portava un permalink que no hem pogut llegir — el més probable és que es truncés pel camí. Demana'l de nou o comença per un dels exemples.",
    unknownTitle: "Aquest desplegament no inclou «{id}»",
    unknownDetail:
      "L'enllaç anomena un conjunt de formes pel seu id, i això només es resol on aquest conjunt està instal·lat. Demana a qui l'ha enviat un enllaç amb les formes incrustades.",
    dismiss: "Descarta",
  },
  prefs: {
    apiKey: "Clau d'API d'Anthropic",
    showKey: "Mostra la clau",
    hideKey: "Amaga la clau",
  },
  companion: {
    warning: "Coses per corregir: {n}",
    guiding: "Camps obligatoris pendents: {n}",
    celebrating: "Tot a punt, sembla complet!",
    idle: "Anem a omplir-lo",
    next: "Següent: {field} →",
    filled: "{filled}/{total} omplerts",
    dismiss: "Tanca l'assistent",
  },
};

const CATALOG: Record<string, Chrome> = { en: EN, es: ES, ca: CA };

/** The playground's own fold: base language → en. (The library matches by RFC 4647 basic filtering over an ordered list; the playground offers plain `es`/`ca`/`en`.) */
export function pickChrome(locale: string | undefined): Chrome {
  return CATALOG[(locale || "en").toLowerCase().split("-")[0]] ?? EN;
}

/** `{name}` placeholders, filled positionally by name. Kept to this because the
 *  only variables here are a count and a name — a plural rule would need a real
 *  formatter, and none of these strings has one. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => String(vars[key] ?? whole));
}

/** English until a provider says otherwise, so a component rendered outside the
 *  app (a test, a story) still reads. */
export const ChromeContext = createContext<Chrome>(EN);

export function useChrome(): Chrome {
  return useContext(ChromeContext);
}
