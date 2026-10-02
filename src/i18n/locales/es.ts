import type { Strings } from "../strings.js";

/** Spanish: the interface words, as data. */
export const strings: Strings = {
  languagePicker: {
    label: "Idioma",
    placeholder: "Buscar o escribir tag…",
    filterPlaceholder: "Filtrar…",
    noMatches: "Sin coincidencias",
  },
  validationPanel: {
    empty: "No hay nada que corregir. El formulario cumple todas las formas.",
    violation: "Infracción",
    warning: "Aviso",
    info: "Información",
    violationDetail: "Los datos no cumplen la forma mientras esto no se resuelva.",
    warningDetail: "Los datos siguen siendo válidos; conviene revisarlo.",
    infoDetail: "Solo a título informativo.",
    reportedValue: "Valor recibido",
    detailsOf: "Detalles de la incidencia en {field}",
    description: "Lo que la validación encontró en el formulario.",
    violations: "Infracciones",
    warnings: "Avisos",
    infos: "Notas",
    goTo: "Ir al campo",
  },
  assist: {
    suggest: "Sugerir",
    suggestOffering: "Sugerir otros valores",
    completeAnnouncement: "Sugerencia lista. Pulsa Tab para aceptarla, Escape para descartarla.",
    completeAccept: "aceptar",
    completeDismiss: "descartar",
  },
  readOnly: {
    "variable-length-path":
      "Se muestra a título informativo. El perfil llega a estos valores por un camino repetitivo, que no indica dónde se guardaría uno nuevo.",
    "compound-path":
      "Se muestra a título informativo. El perfil llega a estos valores combinando varias propiedades, y eso no se puede editar declaración a declaración.",
    "intermediate-missing":
      "Se muestra a título informativo. Este valor pertenece a un recurso relacionado que aún no existe: complétalo primero y este campo se podrá editar.",
    "intermediate-ambiguous":
      "Se muestra a título informativo. Este valor podría pertenecer a más de un recurso relacionado, así que no hay un único sitio donde guardar el cambio.",
    "disjunction-of-shapes":
      "Se muestra a título informativo. El perfil admite varias alternativas aquí, y todas ellas describen un recurso relacionado con estructura propia, no un valor que se pueda escribir.",
    "unsatisfiable-conjunction":
      "Se muestra a título informativo. Varias reglas del perfil se aplican a este campo y se contradicen entre sí, así que ningún valor podría cumplirlas todas.",
  },
  chrome: {
    iriOrSearch: "IRI o buscar…",
    search: "Buscar…",
    addIri: "Añadir una IRI…",
    add: "Añadir…",
    choose: "Elegir…",
    notSet: "Sin definir",
    yes: "Sí",
    no: "No",
    time: "Hora",
    addRow: "Añadir",
    noMatches: "Sin coincidencias",
    remove: "Quitar",
    kindOfValue: "{field} — tipo de valor",
    loading: "Cargando…",
    loadFailed: "No se pudo cargar el formulario: {error}",
    group: "Grupo {n}",
    step: "Paso {n}",
    back: "Atrás",
    next: "Siguiente",
    issues: { one: "{n} incidencia", other: "{n} incidencias" },
    valid: "Válido",
    madeWith: "Hecho con",
    madeAt: "en",
    love: "amor",
  },
};
