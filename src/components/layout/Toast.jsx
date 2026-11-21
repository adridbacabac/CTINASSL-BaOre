import React from "react";
import { Sparkles } from "lucide-react";

export function Toast({ toast }) {
  return toast && <div className="toast"><Sparkles size={15} /> {toast}</div>;
}
