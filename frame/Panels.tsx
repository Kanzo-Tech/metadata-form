// What the page can show beside its form (EmbedConfig.showShapes and showOutput):
// the shapes the form is drawn from, and the record it is writing. A module of
// its own, loaded only when one of them is on, so a page that shows neither does
// not fetch the code editor.
import { useEffect, useState } from "react";
import { Button, DownloadTrigger, JsonTreeView, Tabs, TabsContent, TabsList, TabsTrigger } from "@kanzo-tech/ui";
import { CodeEditor } from "@kanzo-tech/ui/editor";
import { StreamLanguage } from "@codemirror/language";
import { turtle } from "@codemirror/legacy-modes/mode/turtle";
import { DownloadIcon } from "lucide-react";
import type { MetadataFormController } from "@kanzo-tech/metadata-form";
import type { EmbedTexts } from "@kanzo-tech/metadata-form/embed";

// Module-level, one instance: a fresh extension per render reconfigures the editor.
const turtleLang = StreamLanguage.define(turtle);

// A shapes graph runs to a thousand lines: the document scrolls in a box of its
// own, so the iframe does not grow to its length.
const HEIGHT = "32rem";

function TurtleView({ value }: { value: string }) {
  return <CodeEditor value={value} extensions={turtleLang} readOnly lineNumbers wrap={false} maxHeight={HEIGHT} />;
}

/** The variant's shapes, as the page loaded them. Read only: they are what the
 *  form is drawn from, not something to edit here. */
export function ShapesPanel({ shapes }: { shapes: string }) {
  return <TurtleView value={shapes} />;
}

/** The record as the form is writing it, in Turtle and as a JSON-LD tree, kept
 *  up to date with every edit, and the one shown as a file to download. */
export function OutputPanel({ form, texts }: { form: MetadataFormController; texts: EmbedTexts }) {
  const [doc, setDoc] = useState<"turtle" | "jsonld">("turtle");
  const [ttl, setTtl] = useState("");
  const [jsonLd, setJsonLd] = useState<object | null>(null);

  useEffect(() => {
    // An edit may land while the last one is still being serialized: only the
    // newest result is kept.
    let live = true;
    void form.toTurtle().then((t) => live && setTtl(t));
    void form.toJsonLd().then((j) => live && setJsonLd(j));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.quads]);

  const format = doc === "turtle" ? "Turtle" : "JSON-LD";
  return (
    <Tabs value={doc} onValueChange={(d) => setDoc(d.value as "turtle" | "jsonld")}>
      <div className="flex items-center justify-between gap-2">
        <TabsList variant="underline">
          <TabsTrigger value="turtle">Turtle</TabsTrigger>
          <TabsTrigger value="jsonld">JSON-LD</TabsTrigger>
        </TabsList>
        {/* Serialized when somebody asks for the file, not on every edit. */}
        <DownloadTrigger
          asChild
          data={doc === "turtle" ? () => form.toTurtle() : () => form.toJsonLd().then((j) => JSON.stringify(j, null, 2))}
          fileName={doc === "turtle" ? "metadata.ttl" : "metadata.jsonld"}
          mimeType={doc === "turtle" ? "text/turtle" : "application/ld+json"}
        >
          <Button size="sm" variant="outline">
            <DownloadIcon />
            {texts.download.replace("{format}", format)}
          </Button>
        </DownloadTrigger>
      </div>
      <TabsContent value="turtle">
        <TurtleView value={ttl} />
      </TabsContent>
      <TabsContent value="jsonld">
        <div className="overflow-auto rounded-field border p-3" style={{ maxHeight: HEIGHT }}>
          {jsonLd ? <JsonTreeView data={jsonLd} defaultExpandedDepth={2} /> : null}
        </div>
      </TabsContent>
    </Tabs>
  );
}
