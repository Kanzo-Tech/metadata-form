import { useEffect, useState } from "react";

interface SerializableForm {
  ready: boolean;
  toTurtle: () => Promise<string>;
  toJsonLd: () => Promise<object>;
}

/** Live Turtle + JSON-LD serialization of the form's graph, re-derived whenever the
 *  form changes. Stale async results are dropped (the form may change mid-flight). */
export function useFormOutputs(form: SerializableForm): { turtle: string; jsonld: string } {
  const [turtle, setTurtle] = useState("");
  const [jsonld, setJsonld] = useState("");
  useEffect(() => {
    let active = true;
    if (!form.ready) return;
    form.toTurtle().then((t) => active && setTurtle(t));
    form.toJsonLd().then((j) => active && setJsonld(JSON.stringify(j, null, 2)));
    return () => {
      active = false;
    };
  }, [form]);
  return { turtle, jsonld };
}
