import React from "react";
import { KeyRound, Pencil, Plus, RefreshCw, Sparkles, Trash2, Users } from "lucide-react";
import { deleteBlockReason, isSelf } from "../../lib/accounts";

export function TeamPage({
  openAddAccount,
  accounts,
  accountsStatus,
  accountsError,
  accountPending,
  loadAccounts,
  roleLabel,
  currentUser,
  openEditAccount,
  openResetPassword,
  removeAccount,
}) {
  return (
          <section className="content-card inventory-card page-block">
            <div className="card-head">
              <div>
                <div className="eyebrow"><Sparkles size={12} /> store accounts</div>
                <h3>Team</h3>
                <p>Add, edit, or remove an account, and choose Admin or Employee access.</p>
              </div>
              <button type="button" className="primary-btn" onClick={openAddAccount} disabled={accountsStatus !== "ready"}><Plus size={16} /> Add account</button>
            </div>
            {accountsStatus === "loading" && (
              <div className="empty-state">
                <Users size={26} />
                <strong>Loading accounts</strong>
                <span>Fetching the team from the store server.</span>
              </div>
            )}
            {accountsStatus === "error" && (
              <div className="empty-state">
                <Users size={26} />
                <strong>Accounts could not be loaded</strong>
                <span>{accountsError}</span>
                <button type="button" className="secondary-btn" onClick={loadAccounts}><RefreshCw size={15} /> Try again</button>
              </div>
            )}
            {accountsStatus === "ready" && (
              <div className="list-stack">
                {accounts.map((account) => {
                  const deleteBlocked = deleteBlockReason(account, accounts, currentUser);
                  return (
                    <div className="list-row" key={account.id}>
                      <div className="admin-avatar">{account.name.charAt(0)}</div>
                      <div className="row-copy">
                        <strong>{account.name}{isSelf(account, currentUser) ? " (you)" : ""}</strong>
                        <span>{account.email} · {account.username}</span>
                      </div>
                      <span className={account.role === "admin" ? "stock-pill ok" : "category-tag"}>{roleLabel(account.role)}</span>
                      <div className="action-group">
                        <button type="button" className="icon-btn" title="Edit account" aria-label={`Edit ${account.name}`} disabled={accountPending} onClick={() => openEditAccount(account)}><Pencil size={15} /></button>
                        <button type="button" className="icon-btn" title="Reset password" aria-label={`Reset password for ${account.name}`} disabled={accountPending} onClick={() => openResetPassword(account)}><KeyRound size={15} /></button>
                        {!isSelf(account, currentUser) && (
                          <button
                            type="button"
                            className="danger icon-btn"
                            title={deleteBlocked || "Remove account"}
                            aria-label={`Remove ${account.name}`}
                            disabled={accountPending}
                            onClick={() => removeAccount(account)}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
  );
}
