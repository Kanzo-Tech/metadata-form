import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { FramePage, parentChannel } from "./FramePage";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FramePage channel={parentChannel()} />
  </StrictMode>,
);
