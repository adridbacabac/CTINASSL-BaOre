import React from "react";
import { Plus, Users, X } from "lucide-react";

export function AccountModal({ accountModal, setAccountModal, accountForm, setAccountForm, saveAccount }) {
  return accountModal && (
        <div className="modal-shade" onMouseDown={(e) => {
          if (e.target === e.currentTarget) setAccountModal(false);
        }}>
          <div className="product-modal">
            <div className="modal-head">
              <div>
                <div className="eyebrow"><Users size={12} /> Store access</div>
                <h2>Add an account</h2>
              </div>
              <button type="button" className="close-btn" onClick={() => setAccountModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={saveAccount} className="product-form">
              <label>Name<input value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} placeholder="Full name" /></label>
              <div className="form-grid">
                <label>Email<input type="email" value={accountForm.email} onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })} placeholder="name@baore.com" /></label>
                <label>Username<input value={accountForm.username} onChange={(e) => setAccountForm({ ...accountForm, username: e.target.value })} placeholder="username" autoComplete="off" /></label>
              </div>
              <div className="form-grid">
                <label>Password<input type="password" value={accountForm.password} onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })} placeholder="Password" autoComplete="new-password" /></label>
                <label>
                  Access
                  <select value={accountForm.role} onChange={(e) => setAccountForm({ ...accountForm, role: e.target.value })}>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
              </div>
              <div className="form-actions">
                <button type="button" className="secondary-btn" onClick={() => setAccountModal(false)}>Cancel</button>
                <button type="submit" className="primary-btn"><Plus size={15} /> Add account</button>
              </div>
            </form>
          </div>
        </div>
  );
}
