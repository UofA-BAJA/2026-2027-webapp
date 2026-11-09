import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import "./App.css";
import Nave from "./Components/Nave";
import Convert from "./Components/Convert";
import Telemetry from "./Components/Telemetry";
import TelemetryV2 from "./telemetry-v2/TelemetryV2";
import { DarkModeProvider } from "./context/DarkModeContaxt";

function App() {
  // v2 is full-bleed with its own top bar
  const v2 = useLocation().pathname === "/telemetry-v2";
  return (
    <div className="App">
      <DarkModeProvider>
        {!v2 && <Nave />}
        <Routes>
          <Route path="/telemetry" element={<Telemetry />} />
          <Route path="/telemetry-v2" element={<TelemetryV2 />} />
          <Route path="/convert" element={<Convert />} />
          <Route path="*" element={<Navigate to="/telemetry-v2" replace />} />
        </Routes>
      </DarkModeProvider>
    </div>
  );
}

export default App;
