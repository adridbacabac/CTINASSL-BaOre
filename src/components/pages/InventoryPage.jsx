import React from "react";
import { ClipboardList, Package, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { catalogView } from "../../lib/products";

export function InventoryPage({ isAdmin, openAddProduct, items, productsStatus, productsError, productPending, movementPending, loadProducts, money, filteredItems, search, setSearch, filter, setFilter, categories, stockStatus, openMovement, openEditProduct, deleteProduct }) {
  const [stockFilter, setStockFilter] = React.useState("all");
  const visibleItems = filteredItems.filter((item) => stockFilter === "all" || stockStatus(item.quantity).className === stockFilter);
  const catalogState = catalogView(productsStatus, items);

  return (
    <>
      <section className="inventory-showcase" aria-label="Ba'Oré">
        <h2 className="showcase-wordmark">BA'ORÉ</h2>
      </section>

      <section className="content-card inventory-card">
        <div className="card-head">
          <div>
            <h3>All products</h3>
            <p>{isAdmin ? "Your complete Ba'Oré cosmetics catalogue." : "Quantities you can sell from today."}</p>
          </div>
          <span className="pill-chip">{visibleItems.length} products</span>
          {isAdmin && <button type="button" className="primary-btn inventory-add-btn" onClick={openAddProduct} disabled={productsStatus !== "ready" || productPending}><Plus size={15} /> Add product</button>}
        </div>

        <div className="toolbar inventory-toolbar">
          <label className="search-box">
            <Search size={16} />
            <input aria-label="Search products" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product, shade, or SKU..." />
          </label>
          <label className="inventory-filter">
            <span>Category</span>
            <select aria-label="Filter by category" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option>All categories</option>
              {categories.map((category) => <option key={category}>{category}</option>)}
            </select>
          </label>
          <label className="inventory-filter">
            <span>Stock status</span>
            <select aria-label="Filter by stock status" value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}>
              <option value="all">All stock</option>
              <option value="ok">In stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </select>
          </label>
        </div>

        {catalogState === "loading" && (
          <div className="empty-state">
            <Package size={26} />
            <strong>Loading products</strong>
            <span>Fetching the catalogue from the store server.</span>
          </div>
        )}
        {catalogState === "error" && (
          <div className="empty-state">
            <Package size={26} />
            <strong>Products could not be loaded</strong>
            <span>{productsError}</span>
            <button type="button" className="secondary-btn" onClick={loadProducts}><RefreshCw size={15} /> Try again</button>
          </div>
        )}
        {catalogState !== "loading" && catalogState !== "error" && (
          <>
            {visibleItems.length ? (
              <div className="inventory-grid">
                {visibleItems.map((item, index) => {
                  const status = stockStatus(item.quantity);
                  return (
                    <article className="product-card" key={item.id}>
                      <div className={`product-art product-art-${index % 4}`} aria-label="Product image unavailable" role="img">
                        <span className="product-art-frame" />
                        <span className="product-art-monogram">B</span>
                        <span>IMAGE UNAVAILABLE</span>
                      </div>
                      <div className="product-card-content">
                        <div className="product-card-heading">
                          <div>
                            <span className="product-category">{item.category}</span>
                            <h4>{item.name}</h4>
                          </div>
                          <span className={`stock-pill ${status.className}`}>{status.label}</span>
                        </div>
                        <div className="product-card-meta">
                          <span>SKU <b>{item.sku}</b></span>
                          {item.shade && <span>Shade <b>{item.shade}</b></span>}
                          {item.brand && <span>Brand <b>{item.brand}</b></span>}
                        </div>
                        <div className="product-card-values">
                          <div><span>Price</span><b>{money(item.price)}</b></div>
                          <div><span>Quantity</span><b>{item.quantity} <small>pcs</small></b></div>
                        </div>
                        <div className="product-card-actions" aria-label={`Actions for ${item.name}`}>
                          <button type="button" className="product-action product-action-stock" aria-label={`Update stock for ${item.name}`} title={isAdmin ? "Update stock" : "Record stock in or stock out"} disabled={productPending || movementPending} onClick={() => openMovement(item)}>
                            <ClipboardList size={15} /><span>Stock</span>
                          </button>
                          {isAdmin && (
                            <>
                              <button type="button" className="product-action" aria-label={`Edit ${item.name}`} title="Edit product" disabled={productPending || movementPending} onClick={() => openEditProduct(item)}>
                                <Pencil size={15} /><span>Edit</span>
                              </button>
                              <button type="button" className="product-action product-action-danger" aria-label={`Delete ${item.name}`} title="Delete product" disabled={productPending || movementPending} onClick={() => deleteProduct(item)}>
                                <Trash2 size={15} /><span>Delete</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state inventory-empty">
                <Package size={26} />
                <strong>{items.length ? "No products found" : "No products yet"}</strong>
                <span>{items.length ? "Try another search, category, or stock status." : "The catalogue is empty."}</span>
              </div>
            )}

            <div className="table-footer">
              <span>Showing <b>{visibleItems.length}</b> of <b>{items.length}</b> products</span>
              <span><span className="live-dot" /> Saved to the store server</span>
            </div>
          </>
        )}
      </section>
    </>
  );
}
