import { healthDcatApShapes, healthDcatApSampleData } from "./health-dcat-ap/index.js";

/** One input-data sample for a shape (Turtle). */
export interface DataExample {
  id: string;
  label: string;
  ttl: string;
}

/** A shape with several input-data examples. */
export interface ShapeExample {
  id: string;
  label: string;
  shapes: string;
  data: DataExample[];
}

/** Local demo catalog: each shape carries several input-data examples. */
export const EXAMPLES: ShapeExample[] = [
  {
    id: "health-dcat-ap",
    label: "HealthDCAT-AP",
    shapes: healthDcatApShapes,
    data: [
      { id: "empty", label: "Empty (new dataset)", ttl: "" },
      { id: "covid", label: "COVID-19 registry", ttl: healthDcatApSampleData },
    ],
  },
];
