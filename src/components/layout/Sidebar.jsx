import React from "react";
import { ChevronRight, LogOut, Sparkles, X } from "lucide-react";

export function Sidebar({ mobileOpen, setMobileOpen, navItems, activePage, goTo, currentUser, roleLabel, handleLogout }) {
  return (
    <>
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Sparkles size={21} /></div>
          <div className="brand-name">
            <strong>Ba'Oré</strong>
            <span>C O S M E T I C S</span>
          </div>
          <button className="close-nav" type="button" onClick={() => setMobileOpen(false)}><X size={18} /></button>
        </div>

        <div className="store-tag"><span className="tiny-star">✦</span> BEAUTY, BOTTLED</div>

        <div className="nav-caption">MAIN MENU</div>
        {navItems.map((item) => (
          <button key={item.id} type="button" className={`nav-link ${activePage === item.id ? "selected" : ""}`} onClick={() => goTo(item.id)}>
            <item.icon size={18} />
            <span>{item.name}</span>
            <ChevronRight size={15} className="nav-arrow" />
          </button>
        ))}

        <div className="sidebar-spacer" />

        <div className="admin-profile">
          <div className="admin-avatar">{(currentUser.name || "U").charAt(0).toUpperCase()}</div>
          <div>
            <strong>{currentUser.name}</strong>
            <span>{roleLabel(currentUser.role)}</span>
          </div>
          <button type="button" className="logout-btn" onClick={handleLogout} aria-label="Sign out"><LogOut size={15} /></button>
        </div>
      </aside>

      {mobileOpen && <button className="mobile-shade" type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu" />}
    </>
  );
}
