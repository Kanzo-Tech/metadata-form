// `metadata-form/i18n` — languages other than English, as data.
//
// The core carries English only. Each language here is a pair of plain values: the
// interface `strings` (a typed table) and the default validation `messages` (a
// Turtle graph of `sh:message` literals). Pass what you need to `useMetadataForm`:
//
//   import { es, ca } from "metadata-form/i18n";
//   useMetadataForm({ locale: ["es", "ca"], strings: { es: es.strings, ca: ca.strings }, messages: [es.messages, ca.messages] });
//
// A language this package does not ship is added the same way, from your own table
// and your own triples — see the README.

import * as es from "./locales/es.js";
import * as ca from "./locales/ca.js";

export { es, ca };
export type { Strings, DeepPartial, StringTables, Plural } from "./strings.js";
