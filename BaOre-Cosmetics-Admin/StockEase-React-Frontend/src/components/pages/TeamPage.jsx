import React from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";

export function TeamPage({ openAddAccount, users, roleLabel, sameAccount, removeAccount }) {
  return (
          <section className="content-card inventory-card page-block">
            <div className="card-head">
              <div>
                <div className="eyebrow"><Sparkles size={12} /> store accounts</div>
                <h3>Team</h3>
                <p>Add or remove an account, and choose Admin or Employee access.</p>
              </div>
              <button type="button" className="primary-btn" onClick={openAddAccount}><Plus size={16} /> Add account</button>
            </div>
            <div className="list-stack">
              {users.map((user) => (
                <div className="list-row" key={user.id}>
                  <div className="admin-avatar">{user.name.charAt(0)}</div>
                  <div className="row-copy">
                    <strong>{user.name}</strong>
                    <span>{user.email} · {user.username}</span>
                  </div>
                  <span className={user.role === "admin" ? "stock-pill ok" : "category-tag"}>{roleLabel(user.role)}</span>
                  {!sameAccount(user) && (
                    <button type="button" className="danger icon-btn" title="Remove account" aria-label={`Remove ${user.name}`} onClick={() => removeAccount(user)}><Trash2 size={15} /></button>
                  )}
                </div>
              ))}
            </div>
          </section>
  );
}
