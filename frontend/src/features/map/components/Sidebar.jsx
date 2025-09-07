import React from "react";
import { useMapCtx } from "../MapContext.jsx";
import PaginatedList from "./PaginatedList.jsx";

/** Right-hand panel with paginated server data. */
export default function Sidebar() {
  const { sidebarOpen } = useMapCtx();

  return (
    <div className="absolute top-0 right-0 h-full z-30 pointer-events-none">
      <div
        className={[
          "pointer-events-auto h-full w-[300px] flex flex-col transition-all duration-200",
          "border-l bg-white/90 shadow-xl",
        ].join(" ")}
        style={{ display: sidebarOpen ? "flex" : "none" }}
      >
        <div
          className="p-3 border-b border-slate-200 flex items-center justify-between bg-indigo-600 text-white"
        >
          <div className="font-semibold">Records</div>
        </div>

        <PaginatedList />
      </div>
    </div>
  );
}