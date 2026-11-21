import React from "react";
import { Sparkles } from "lucide-react";

export function SessionNotice({ status, message, onRetry }) {
  const checking = status === "loading";
  return (
    <div className="auth-shell">
      <div className="auth-panel auth-panel-solo">
        <section className="auth-card">
          <div className="eyebrow"><Sparkles size={12} /> Store sign in</div>
          <h2>{checking ? "Checking your session" : "The server could not be reached"}</h2>
          <p className="muted">{checking ? "One moment while the store confirms your account." : message}</p>
          {!checking && (
            <button type="button" className="primary-btn auth-submit" onClick={onRetry}>Try again</button>
          )}
        </section>
      </div>
    </div>
  );
}
