import { createFileRoute } from "@tanstack/react-router";
import { SessionApp } from "@/components/session-app";
import { getSessionFn } from "@/lib/bcgame/actions";

export const Route = createFileRoute("/")({
  loader: () => getSessionFn(),
  component: Home,
});

function Home() {
  const initial = Route.useLoaderData();
  return <SessionApp initial={initial} />;
}
