import BaseMap from "./map/BaseMap";

export default function App() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-map-base">
      <BaseMap />
    </div>
  );
}