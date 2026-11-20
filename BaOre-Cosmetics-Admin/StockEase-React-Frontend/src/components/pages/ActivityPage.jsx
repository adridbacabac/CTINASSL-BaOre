import React from "react";
import { History, Sparkles } from "lucide-react";

export function ActivityPage({ movements, items, users, movementDelta, movementLabel }) {
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
            {movements.length ? (
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
                      const staff = users.find((user) => user.id === movement.userId);
                      const delta = movementDelta(movement);
                      return (
                        <tr key={movement.id}>
                          <td>{new Date(movement.createdAt).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                          <td>{staff?.name || "Unknown"}</td>
                          <td><strong>{product?.name || "Removed product"}</strong></td>
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
