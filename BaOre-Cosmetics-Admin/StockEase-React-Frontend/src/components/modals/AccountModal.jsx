import React from "react";
import { KeyRound, Plus, Save, Users, X } from "lucide-react";
import { roleLockReason } from "../../lib/accounts";

const titles = {
  create: "Add an account",
  edit: "Edit account",
  password: "Reset password",
};

export function AccountModal({
  accountModal,
  setAccountModal,
  accountForm,
  setAccountForm,
  saveAccount,
  accountPending,
  accounts,
  currentUser,
}) {
  if (!accountModal) return null;
  const { mode, account } = accountModal;
  const close = () => {
    if (!accountPending) setAccountModal(null);
  };
  const roleLocked = mode === "edit" ? roleLockReason(account, accounts, currentUser) : "";

  return (
        <div className="modal-shade" onMouseDown={(e) => {
          if (e.target === e.currentTarget) close();
        }}>
          <div className="product-modal">
            <div className="modal-head">
              <div>
                <div className="eyebrow"><Users size={12} /> Store access</div>
                <h2>{titles[mode]}</h2>
              </div>
              <button type="button" className="close-btn" onClick={close}><X size={18} /></button>
            </div>
            <form onSubmit={saveAccount} className="product-form">
              {mode === "password" ? (
                <>
                  <p>Set a new password for <strong>{account.name}</strong> ({account.username}). Their other signed-in sessions will end.</p>
                  <label>New password<input type="password" value={accountForm.password} onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })} placeholder="At least 8 characters" autoComplete="new-password" /></label>
                </>
              ) : (
                <>
                  <label>Name<input value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} placeholder="Full name" /></label>
                  <div className="form-grid">
                    <label>Email<input type="email" value={accountForm.email} onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })} placeholder="name@baore.com" /></label>
                    <label>Username<input value={accountForm.username} onChange={(e) => setAccountForm({ ...accountForm, username: e.target.value })} placeholder="username" autoComplete="off" /></label>
                  </div>
                  <div className="form-grid">
                    {mode === "create" && (
                      <label>Password<input type="password" value={accountForm.password} onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })} placeholder="At least 8 characters" autoComplete="new-password" /></label>
                    )}
                    <label>
                      Access
                      <select value={accountForm.role} disabled={Boolean(roleLocked)} title={roleLocked || undefined} onChange={(e) => setAccountForm({ ...accountForm, role: e.target.value })}>
                        <option value="user">Employee</option>
                        <option value="admin">Admin</option>
                      </select>
                    </label>
                  </div>
                  {roleLocked && <p>{roleLocked}</p>}
                </>
              )}
              <div className="form-actions">
                <button type="button" className="secondary-btn" onClick={close} disabled={accountPending}>Cancel</button>
                <button type="submit" className="primary-btn" disabled={accountPending}>
                  {mode === "create" && <><Plus size={15} /> Add account</>}
                  {mode === "edit" && <><Save size={15} /> Save changes</>}
                  {mode === "password" && <><KeyRound size={15} /> Reset password</>}
                </button>
              </div>
            </form>
          </div>
        </div>
  );
}
