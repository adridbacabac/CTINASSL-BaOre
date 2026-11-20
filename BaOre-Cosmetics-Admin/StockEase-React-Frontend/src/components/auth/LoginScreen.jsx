import React from "react";
import { ChevronRight, Sparkles } from "lucide-react";
import { Toast } from "../layout/Toast";

export function LoginScreen({ username, setUsername, password, setPassword, loginError, setLoginError, handleLogin, toast }) {
  return (
      <div className="auth-shell">
        <div className="auth-panel auth-panel-solo">
          <section className="auth-card">
            <form className="auth-form" onSubmit={handleLogin}>
              <div className="eyebrow"><Sparkles size={12} /> Store sign in</div>
              <h2>Welcome back</h2>
              <p className="muted">Use your store username. The account role opens the tools you need.</p>
              <label>
                Username
                <input
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setLoginError(""); }}
                  placeholder="admin"
                  autoComplete="username"
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setLoginError(""); }}
                  placeholder="Your password"
                  autoComplete="current-password"
                />
              </label>
              {loginError && <p className="form-error">{loginError}</p>}
              <button type="submit" className="primary-btn auth-submit">Sign in <ChevronRight size={16} /></button>
            </form>
          </section>
        </div>
        <Toast toast={toast} />
      </div>
  );
}
