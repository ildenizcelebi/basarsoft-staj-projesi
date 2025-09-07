import React from "react";
import MapNavbar from "./features/map/components/MapNavbar.jsx";
import Sidebar from "./features/map/components/Sidebar.jsx";
import { MapProvider } from "./features/map/MapContext.jsx";
import MapView from "./features/map/MapView.jsx";
import { Toaster } from "react-hot-toast";

/**
 * Root application layout with map and side panel.
 * The Toaster is mounted once here for global notifications.
 */
export default function App() {
  return (
    <MapProvider>
      <div className="h-screen w-screen flex flex-col">
        <MapNavbar />
        <div className="flex-1 relative">
          <MapView />
          <Sidebar />
        </div>
      </div>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 5500,
          style: { fontSize: "14px" },
          success: { duration: 4000 },
          error: { duration: 7000 },
        }}
      />
    </MapProvider>
  );
}