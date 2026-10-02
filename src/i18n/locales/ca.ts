import type { Strings } from "../strings.js";

/** Catalan: the interface words, as data. */
export const strings: Strings = {
  languagePicker: {
    label: "Idioma",
    placeholder: "Cerca o escriu un tag…",
    filterPlaceholder: "Filtra…",
    noMatches: "Sense coincidències",
  },
  validationPanel: {
    empty: "No hi ha res a corregir. El formulari compleix totes les formes.",
    violation: "Infracció",
    warning: "Avís",
    info: "Informació",
    violationDetail: "Les dades no compleixen la forma mentre això no es resolgui.",
    warningDetail: "Les dades continuen sent vàlides; convé revisar-ho.",
    infoDetail: "Només a títol informatiu.",
    reportedValue: "Valor rebut",
    detailsOf: "Detalls de la incidència a {field}",
    description: "El que la validació ha trobat al formulari.",
    violations: "Infraccions",
    warnings: "Avisos",
    infos: "Notes",
    goTo: "Ves al camp",
  },
  assist: {
    assist: "Assistència IA",
    accept: "Accepta el suggeriment",
    others: "Suggereix altres valors",
    revert: "Desfés el suggeriment",
    acceptKey: "acceptar",
    dismissKey: "descartar",
    nextKey: "següent",
    announcement: "Suggeriment a punt. Prem Tab per acceptar-lo, Escape per descartar-lo.",
    thinking: "Pensant…",
    empty: "Res a suggerir.",
    failed: "No s'ha pogut obtenir el suggeriment.",
    dismiss: "Descarta {text}",
  },
  readOnly: {
    "variable-length-path":
      "Es mostra a títol informatiu. El perfil arriba a aquests valors per un camí repetitiu, que no indica on es desaria un de nou.",
    "compound-path":
      "Es mostra a títol informatiu. El perfil arriba a aquests valors combinant diverses propietats, i això no es pot editar declaració a declaració.",
    "intermediate-missing":
      "Es mostra a títol informatiu. Aquest valor pertany a un recurs relacionat que encara no existeix: completa'l primer i aquest camp es podrà editar.",
    "intermediate-ambiguous":
      "Es mostra a títol informatiu. Aquest valor podria pertànyer a més d'un recurs relacionat, així que no hi ha un únic lloc on desar el canvi.",
    "disjunction-of-shapes":
      "Es mostra a títol informatiu. El perfil admet diverses alternatives aquí, i totes descriuen un recurs relacionat amb estructura pròpia, no un valor que es pugui escriure.",
    "unsatisfiable-conjunction":
      "Es mostra a títol informatiu. Diverses regles del perfil s'apliquen a aquest camp i es contradiuen entre elles, així que cap valor no les podria complir totes.",
  },
  chrome: {
    iriOrSearch: "IRI o cerca…",
    search: "Cerca…",
    addIri: "Afegeix una IRI…",
    add: "Afegeix…",
    choose: "Tria…",
    notSet: "Sense definir",
    yes: "Sí",
    no: "No",
    time: "Hora",
    addRow: "Afegeix",
    noMatches: "Sense coincidències",
    remove: "Treu",
    kindOfValue: "{field} — tipus de valor",
    loading: "Carregant…",
    loadFailed: "No s'ha pogut carregar el formulari: {error}",
    group: "Grup {n}",
    step: "Pas {n}",
    back: "Enrere",
    next: "Següent",
    issues: { one: "{n} incidència", other: "{n} incidències" },
    valid: "Vàlid",
    madeWith: "Fet amb",
    madeAt: "a",
    love: "amor",
  },
};
