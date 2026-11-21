import React from "react";
import { Menu } from "lucide-react";

export function Topbar({ setMobileOpen, pageTitle, hideBreadcrumb = false, currentUser, roleLabel }) {
  return (
        <header className="topbar">
          <button className="mobile-toggle" type="button" onClick={() => setMobileOpen(true)}><Menu size={18} /></button>
          {!hideBreadcrumb && <div className="crumb">Ba'Oré Cosmetics <span>/</span> <b>{pageTitle}</b></div>}
          <div className="top-actions">
            <span className="live-dot" />
            <span>{roleLabel(currentUser.role)} session</span>
            <div className="top-avatar">{(currentUser.name || "U").charAt(0).toUpperCase()}</div>
          </div>
        </header>
  );
}
