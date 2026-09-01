import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrainRaid } from "@/game/Game";
import "@/styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrainRaid />
  </StrictMode>,
);
