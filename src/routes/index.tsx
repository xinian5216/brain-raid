import { createFileRoute } from "@tanstack/react-router";
import { BrainRaid } from "@/game/Game";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <BrainRaid />;
}
