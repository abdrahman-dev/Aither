import BaseMap from "./map/BaseMap";
import RoutePlanner from "./features/routing/RoutePlanner";
import ResultsCard from "./features/routing/ResultsCard";
import { useTripPlanning } from "./features/routing/useTripPlanning";

export default function App() {
  const planning = useTripPlanning();

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-map-base">
      {/* The map stays the primary visual element (§27); panels float above it. */}
      <BaseMap
        origin={planning.origin}
        destination={planning.destination}
        pickingPoint={planning.pickingTarget}
        onMapClick={planning.handleMapClick}
        routeResult={planning.result}
        currentLocation={planning.currentLocation}
      />
      <div className="absolute left-4 top-4 z-10 flex max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-sm flex-col gap-3 overflow-y-auto">
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
      </div>
    </div>
  );
}
