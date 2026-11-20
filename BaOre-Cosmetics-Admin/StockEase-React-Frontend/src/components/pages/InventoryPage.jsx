import React from "react";
import { ClipboardList, Package, Pencil, Plus, Search, Sparkles, Trash2 } from "lucide-react";

export function InventoryPage({ isAdmin, openAddProduct, items, totalUnits, lowStockItems, inventoryValue, money, filteredItems, search, setSearch, filter, setFilter, categories, stockStatus, openMovement, openEditProduct, deleteProduct }) {
  return (
        <>
        <section className="page-title" id="inventory-section">
          <div>
            <div className="eyebrow"><Sparkles size={12} /> your beauty collection</div>
            <h1>{isAdmin ? "Product Inventory" : "Floor stock"}</h1>
            <p className="muted">{isAdmin ? "Manage every lipstick, palette, and beauty essential." : "Search the shelf and record stock in or stock out. Catalogue changes stay with your manager."}</p>
          </div>
          {isAdmin && <button type="button" className="primary-btn" onClick={openAddProduct}><Plus size={16} /> Add product</button>}
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
                        <button type="button" title={isAdmin ? "Update stock" : "Record stock in or stock out"} onClick={() => openMovement(item)}><ClipboardList size={15} /></button>
                        {isAdmin && <button type="button" title="Edit product" onClick={() => openEditProduct(item)}><Pencil size={15} /></button>}
                        {isAdmin && <button type="button" className="danger" title="Delete product" onClick={() => deleteProduct(item)}><Trash2 size={15} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredItems.length && (
              <div className="empty-state">
                <Package size={26} />
                <strong>No products found</strong>
                <span>{isAdmin ? "Try another search or add a new product." : "Try another search or shade."}</span>
              </div>
            )}
          </div>

          <div className="table-footer">
            <span>Showing <b>{filteredItems.length}</b> of <b>{items.length}</b> products</span>
            <span><span className="live-dot" /> Inventory changes are saved automatically</span>
          </div>
        </section>
        </>
  );
}
