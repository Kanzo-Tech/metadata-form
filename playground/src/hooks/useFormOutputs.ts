import { useEffect, useState } from "react";

interface SerializableForm {
  ready: boolean;
  toTurtle: () => Promise<string>;
  toJsonLd: () => Promise<object>;
}

export interface FormOutputs {
  turtle: string;
  /** The document itself — `JsonTreeView` wants the value, not a rendering of it.
   *  Stringifying here was the whole reason the pane could only be a text dump. */
  jsonld: object | null;
}

/** Live Turtle + JSON-LD serialization of the form's graph, re-derived whenever the
 *  form changes. Stale async results are dropped (the form may change mid-flight). */
export function useFormOutputs(form: SerializableForm): FormOutputs {
  const [turtle, setTurtle] = useState("");
  const [jsonld, setJsonld] = useState<object | null>(null);
  useEffect(() => {
    let active = true;
    if (!form.ready) return;
    form.toTurtle().then((t) => active && setTurtle(t));
    form.toJsonLd().then((j) => active && setJsonld(j));
    return () => {
      active = false;
    };
  }, [form]);
  return { turtle, jsonld };
}
