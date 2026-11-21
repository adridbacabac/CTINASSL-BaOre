import React from "react";
import { Menu } from "lucide-react";

export function Topbar({ setMobileOpen }) {
  return (
    <header className="topbar">
      <button className="mobile-toggle" type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
        <Menu size={18} />
      </button>
    </header>
  );
}
