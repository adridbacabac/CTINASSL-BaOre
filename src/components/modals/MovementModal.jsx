import React from "react";
import { ClipboardList, Sparkles, X } from "lucide-react";

export function MovementModal({ movementModal, setMovementModal, movementForm, setMovementForm, movementTypes, isAdmin, saveMovement, movementPending }) {
  return movementModal && (
        <div className="modal-shade" onMouseDown={(e) => {
          if (e.target === e.currentTarget) setMovementModal(null);
        }}>
          <div className="product-modal">
            <div className="modal-head">
              <div>
                <div className="eyebrow"><ClipboardList size={12} /> {movementModal.sku}</div>
                <h2>Update stock</h2>
                <p className="muted">{movementModal.name} · {movementModal.quantity} on hand</p>
              </div>
              <button type="button" className="close-btn" onClick={() => setMovementModal(null)}><X size={18} /></button>
            </div>
            <form onSubmit={saveMovement} className="product-form">
              <label>
                Movement
                <select value={movementForm.type} onChange={(e) => setMovementForm({ ...movementForm, type: e.target.value })}>
                  {movementTypes.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
                </select>
              </label>
              {movementForm.type === "adjustment" && (
                <label>
                  Direction
                  <select value={movementForm.direction} onChange={(e) => setMovementForm({ ...movementForm, direction: e.target.value })}>
                    <option value="in">Add units</option>
                    <option value="out">Remove units</option>
                  </select>
                </label>
              )}
              <label>
                Units
                <input type="number" min="1" step="1" value={movementForm.quantity} onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })} placeholder="1" />
              </label>
              <label>
                Note
                <input value={movementForm.note} onChange={(e) => setMovementForm({ ...movementForm, note: e.target.value })} placeholder={isAdmin ? "New shipment, count fix..." : "Received stock, items leaving the shelf..."} />
              </label>
              <div className="form-actions">
                <button type="button" className="secondary-btn" onClick={() => setMovementModal(null)} disabled={movementPending}>Cancel</button>
                <button type="submit" className="primary-btn" disabled={movementPending}><Sparkles size={15} /> Save movement</button>
              </div>
            </form>
          </div>
        </div>
  );
}
