import React from "react";
import { ClipboardList, Package, Pencil, Plus, RefreshCw, Search, Sparkles, Trash2 } from "lucide-react";
import { catalogView } from "../../lib/products";

export function InventoryPage({ isAdmin, openAddProduct, items, productsStatus, productsError, productPending, movementPending, loadProducts, totalUnits, lowStockItems, inventoryValue, money, filteredItems, search, setSearch, filter, setFilter, categories, stockStatus, openMovement, openEditProduct, deleteProduct }) {
  return (
        <>
        <section className="page-title" id="inventory-section">
          <div>
            <div className="eyebrow"><Sparkles size={12} /> your beauty collection</div>
            <h1>{isAdmin ? "Product Inventory" : "Floor stock"}</h1>
            <p className="muted">{isAdmin ? "Manage every lipstick, palette, and beauty essential." : "Search the shelf and record stock in or stock out. Catalogue changes stay with your manager."}</p>
          </div>
          {isAdmin && <button type="button" className="primary-btn" onClick={openAddProduct} disabled={productsStatus !== "ready" || productPending}><Plus size={16} /> Add product</button>}
        </section>

        <section className={`inventory-summary ${isAdmin ? "" : "cols-3"}`}>
          <div><span>Products listed</span><b>{items.length}</b></div>
          <div><span>Total units</span><b>{totalUnits}</b></div>
          <div><span>Low stock alerts</span><b className="warn-text">{lowStockItems.length}</b></div>
          {isAdmin && <div><span>Inventory value</span><b>{money(inventoryValue)}</b></div>}
        </section>

        <section className="content-card inventory-card">
          <div className="card-head">
            <div>
              <h3>All products</h3>
              <p>{isAdmin ? "Your complete Ba'Oré cosmetics catalogue." : "Quantities you can sell from today."}</p>
            </div>
            <span className="pill-chip">{filteredItems.length} products</span>
          </div>

          <div className="toolbar">
            <div className="search-box"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product, shade, or SKU..." /></div>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option>All categories</option>
              {categories.map((category) => <option key={category}>{category}</option>)}
            </select>
          </div>

          {catalogView(productsStatus, items) === "loading" && (
            <div className="empty-state">
              <Package size={26} />
              <strong>Loading products</strong>
              <span>Fetching the catalogue from the store server.</span>
            </div>
          )}
          {catalogView(productsStatus, items) === "error" && (
            <div className="empty-state">
              <Package size={26} />
              <strong>Products could not be loaded</strong>
              <span>{productsError}</span>
              <button type="button" className="secondary-btn" onClick={loadProducts}><RefreshCw size={15} /> Try again</button>
            </div>
          )}
          {catalogView(productsStatus, items) !== "loading" && catalogView(productsStatus, items) !== "error" && (
          <>
          <div className="table-wrap">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Shade</th>
                  <th>Quantity</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, index) => (
                  <tr key={item.id}>
                    <td>
                      <div className="product-cell">
                        <div className={`mini-box box-${index % 4}`}><Sparkles size={14} /></div>
                        <div>
                          <strong>{item.name}</strong>
                          <span>{item.brand}</span>
                        </div>
                      </div>
                    </td>
                    <td><code>{item.sku}</code></td>
                    <td><span className="category-tag">{item.category}</span></td>
                    <td>{item.shade || "—"}</td>
                    <td><b>{item.quantity}</b> pcs</td>
                    <td className="price-cell">{money(item.price)}</td>
                    <td><span className={`stock-pill ${stockStatus(item.quantity).className}`}>{stockStatus(item.quantity).label}</span></td>
                    <td>
                      <div className="action-group">
                        <button type="button" title={isAdmin ? "Update stock" : "Record stock in or stock out"} disabled={productPending || movementPending} onClick={() => openMovement(item)}><ClipboardList size={15} /></button>
                        {isAdmin && <button type="button" title="Edit product" disabled={productPending || movementPending} onClick={() => openEditProduct(item)}><Pencil size={15} /></button>}
                        {isAdmin && <button type="button" className="danger" title="Delete product" disabled={productPending || movementPending} onClick={() => deleteProduct(item)}><Trash2 size={15} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredItems.length && (
              <div className="empty-state">
                <Package size={26} />
                <strong>{items.length ? "No products found" : "No products yet"}</strong>
                <span>{items.length ? (isAdmin ? "Try another search or add a new product." : "Try another search or shade.") : "The catalogue is empty."}</span>
              </div>
            )}
          </div>

          <div className="table-footer">
            <span>Showing <b>{filteredItems.length}</b> of <b>{items.length}</b> products</span>
            <span><span className="live-dot" /> Saved to the store server</span>
          </div>
          </>
          )}
        </section>
        </>
  );
}
