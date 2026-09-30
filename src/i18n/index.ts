// `metadata-form/i18n` — languages other than English, as data.
//
// The core carries English only. Each language here is the interface `strings`, a
// typed table. Pass what you need to `useMetadataForm`:
//
//   import { es, ca } from "metadata-form/i18n";
//   useMetadataForm({ locale: ["es", "ca"], strings: { es: es.strings, ca: ca.strings } });
//
// The default validation messages are not here: the engine carries English, Spanish
// and Catalan. A language none of them covers is added the same way, from your own
// table and, for the messages, your own triples (`messages`) — see the README.

import * as es from "./locales/es.js";
import * as ca from "./locales/ca.js";

export { es, ca };
export type { Strings, DeepPartial, StringTables, Plural } from "./strings.js";
