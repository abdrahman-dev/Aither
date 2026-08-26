import { useState } from "react";
import BaseMap from "./map/BaseMap";
import RoutePlanner from "./features/routing/RoutePlanner";
import ResultsCard from "./features/routing/ResultsCard";
import { useTripPlanning } from "./features/routing/useTripPlanning";
import LandingPage from "./features/landing/LandingPage";

export default function App() {
  const [view, setView] = useState<"landing" | "app">("landing");
  const planning = useTripPlanning();

  if (view === "landing") {
    return <LandingPage onEnter={() => setView("app")} />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-map-base">
      {/* Structural planning column instead of a floating overlay (Phase 3.B
          rebalance): the panel is a first-class region beside the map, so
          neither feels secondary on desktop, and the fixed-width flex row can
          later collapse to an overlay/bottom sheet on mobile without a rewrite.
          Cards keep their own glass styling on the shared app background.
          Width is sized so the three-column date/time row gives native time
          inputs room to show their full value including AM/PM. */}
      <aside className="flex h-full w-[480px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-border-subtle bg-map-base p-4">
        <RoutePlanner
          origin={planning.origin}
          destination={planning.destination}
          pickingTarget={planning.pickingTarget}
          onTogglePick={planning.togglePick}
          onPublishResult={planning.publishResult}
          hasResult={planning.result !== null}
          onUseCurrentLocation={planning.fetchCurrentLocation}
          locationStatus={planning.locationStatus}
        />
        {planning.result && (
          <ResultsCard
            result={planning.result}
            onDismiss={planning.clearResult}
            context={planning.resultContext}
          />
        )}
      </aside>
      <main className="relative h-full min-w-0 flex-1">
        {/* The map stays the primary visual element (§27); it now owns the full
            remaining viewport instead of sitting under floating panels. */}
        <BaseMap
          origin={planning.origin}
          destination={planning.destination}
          pickingPoint={planning.pickingTarget}
          onMapClick={planning.handleMapClick}
          routeResult={planning.result}
          currentLocation={planning.currentLocation}
        />
      </main>
    </div>
  );
}
