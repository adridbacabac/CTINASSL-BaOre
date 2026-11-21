import React from "react";
import { AlertTriangle, Boxes, ChevronRight, CircleDollarSign, ClipboardList, Droplets, Eye, Heart, Package, Plus, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { activityView, catalogView, movementProductLabel } from "../../lib/products";

export function DashboardPage({ isAdmin, displayName, openAddProduct, items, productsStatus, productsError, movementsStatus, movementsError, loadProducts, totalUnits, lowStockItems, inventoryValue, money, stockStatus, goTo, myMovements, movementDelta, movementLabel }) {
  const productsView = catalogView(productsStatus, items);
  const movementsView = activityView(movementsStatus, myMovements);
  return (
        <>
        <section className="welcome-row">
          <div>
            <div className="eyebrow"><Sparkles size={12} /> {isAdmin ? "Your beauty business at a glance" : "Your shift at a glance"}</div>
            <h1>Good day, {displayName}</h1>
            <p className="muted">{isAdmin ? "Here’s the latest glow-up of your store inventory." : "Check the shelf, catch low stock, and record what leaves the counter."}</p>
          </div>
          {isAdmin && <button type="button" className="primary-btn" onClick={openAddProduct} disabled={productsStatus !== "ready"}><Plus size={16} /> Add product</button>}
        </section>

        {productsView === "loading" && (
          <div className="empty-state">
            <Package size={26} />
            <strong>Loading the store</strong>
            <span>Fetching products and stock movements from the store server.</span>
          </div>
        )}
        {productsView === "error" && (
          <div className="empty-state">
            <Package size={26} />
            <strong>The dashboard could not be loaded</strong>
            <span>{productsError}</span>
            <button type="button" className="secondary-btn" onClick={loadProducts}><RefreshCw size={15} /> Try again</button>
          </div>
        )}
        {productsView !== "loading" && productsView !== "error" && (
        <>
        <section className={`stats-grid ${isAdmin ? "" : "cols-3"}`}>
          <article className="stat-card">
            <div className="stat-label">Total products <span className="icon-box lavender"><Package size={18} /></span></div>
            <div className="stat-value">{items.length}</div>
            <div className="stat-foot">Unique beauty products</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">Stock units <span className="icon-box pink"><Boxes size={18} /></span></div>
            <div className="stat-value">{totalUnits}</div>
            <div className="stat-foot">Pieces available in store</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">Low stock <span className="icon-box peach"><AlertTriangle size={18} /></span></div>
            <div className="stat-value">{lowStockItems.length}</div>
            <div className="stat-foot">Products need a restock</div>
          </article>
          {isAdmin && (
          <article className="stat-card">
            <div className="stat-label">Inventory value <span className="icon-box lilac"><CircleDollarSign size={18} /></span></div>
            <div className="stat-value money-value">{money(inventoryValue)}</div>
            <div className="stat-foot">Total value at selling price</div>
          </article>
          )}
        </section>

        <section className="dashboard-grid">
          <div className="content-card">
            <div className="card-head">
              <div>
                <h3>Recently in your collection</h3>
                <p>A quick look at your beauty shelf.</p>
              </div>
            </div>
            {items.length ? (
            <div className="list-stack">
              {items.slice(0, 5).map((item, index) => (
                <div className="list-row" key={item.id}>
                  <div className={`mini-icon icon-${index % 4}`}>
                    {index % 4 === 0 ? <Heart size={17} /> : index % 4 === 1 ? <Droplets size={17} /> : index % 4 === 2 ? <Sparkles size={17} /> : <Eye size={17} />}
                  </div>
                  <div className="row-copy">
                    <strong>{item.name}</strong>
                    <span>{item.category} · {item.shade || "No shade"}</span>
                  </div>
                  <div className="row-price">{money(item.price)}</div>
                  <span className={`stock-pill ${stockStatus(item.quantity).className}`}>{stockStatus(item.quantity).label}</span>
                </div>
              ))}
            </div>
            ) : (
              <div className="all-good"><Package size={24} /> <strong>No products yet</strong> <span>The catalogue is empty.</span></div>
            )}
          </div>

          <div className="content-card">
            <div className="card-head">
              <div>
                <h3>Needs a little love</h3>
                <p>Products running low on stock.</p>
              </div>
              <span className="alert-count">{lowStockItems.length}</span>
            </div>

            {lowStockItems.length ? (
              <div className="list-stack small-stack">
                {lowStockItems.slice(0, 4).map((item) => (
                  <div className="low-row" key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.sku}</span>
                    </div>
                    <b>{item.quantity} left</b>
                  </div>
                ))}
              </div>
            ) : (
              <div className="all-good"><ShieldCheck size={24} /> <strong>All stocked up!</strong> <span>No products need attention.</span></div>
            )}

            <button type="button" className="restock-btn" onClick={() => goTo("inventory")}>{isAdmin ? "Manage stock" : "Review floor stock"} <ChevronRight size={14} /></button>
          </div>
        </section>

        {!isAdmin && (
          <section className="content-card feature-card">
            <div className="card-head">
              <div>
                <h3>Your recent updates</h3>
                <p>Stock in and stock out recorded on your account.</p>
              </div>
            </div>
            {movementsView === "loading" ? (
              <div className="all-good"><ClipboardList size={24} /> <strong>Loading your updates</strong> <span>Fetching the movements recorded on your account.</span></div>
            ) : movementsView === "error" ? (
              <div className="all-good">
                <ClipboardList size={24} />
                <strong>Your updates could not be loaded</strong>
                <span>{movementsError}</span>
                <button type="button" className="secondary-btn" onClick={loadProducts}><RefreshCw size={15} /> Try again</button>
              </div>
            ) : movementsView === "ready" ? (
              <div className="list-stack">
                {myMovements.slice(0, 5).map((movement) => {
                  const product = movementProductLabel(movement);
                  const delta = movementDelta(movement);
                  return (
                    <div className="low-row" key={movement.id}>
                      <div>
                        <strong>{product.name}</strong>
                        <span>{[product.sku, movementLabel(movement.type), movement.note || "No note"].filter(Boolean).join(" · ")}</span>
                      </div>
                      <b className={delta < 0 ? "warn-text" : ""}>{delta > 0 ? `+${delta}` : delta}</b>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="all-good"><ClipboardList size={24} /> <strong>Nothing recorded yet</strong> <span>Stock in and stock out you save will show up here.</span></div>
            )}
          </section>
        )}
        </>
        )}
        </>
  );
}
