import React from "react";
import { History, RefreshCw, Sparkles } from "lucide-react";
import { movementStaff } from "../../lib/accounts";

export function ActivityPage({ movements, movementsStatus, movementsError, loadMovements, items, accounts, currentUser, movementDelta, movementLabel }) {
  return (
          <section className="content-card inventory-card page-block">
            <div className="card-head">
              <div>
                <div className="eyebrow"><Sparkles size={12} /> stock movements</div>
                <h3>Who changed the shelf</h3>
                <p>Restocks, sales, adjustments, and returns, tied to the person who recorded them.</p>
              </div>
              <span className="pill-chip">{movements.length} records</span>
            </div>
            {movementsStatus === "loading" || movementsStatus === "idle" ? (
              <div className="empty-state">
                <History size={26} />
                <strong>Loading activity</strong>
                <span>Fetching stock movements from the store server.</span>
              </div>
            ) : movementsStatus === "error" ? (
              <div className="empty-state">
                <History size={26} />
                <strong>Activity could not be loaded</strong>
                <span>{movementsError}</span>
                <button type="button" className="secondary-btn" onClick={loadMovements}><RefreshCw size={15} /> Try again</button>
              </div>
            ) : movements.length ? (
              <div className="table-wrap">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Staff</th>
                      <th>Product</th>
                      <th>Type</th>
                      <th>Change</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((movement) => {
                      const product = items.find((item) => item.id === movement.productId);
                      const productName = product?.name || movement.productName || "Removed product";
                      const staff = movementStaff(movement, accounts, currentUser);
                      const delta = movementDelta(movement);
                      return (
                        <tr key={movement.id}>
                          <td>{new Date(movement.createdAt).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                          <td>{staff?.name || "Unknown"}</td>
                          <td><strong>{productName}</strong></td>
                          <td><span className="category-tag">{movementLabel(movement.type)}</span></td>
                          <td className={delta < 0 ? "warn-text" : "price-cell"}>{delta > 0 ? `+${delta}` : delta}</td>
                          <td>{movement.note || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <History size={26} />
                <strong>No stock movements yet</strong>
                <span>Sales, restocks, and adjustments will be listed here.</span>
              </div>
            )}
          </section>
  );
}
