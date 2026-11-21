import React from "react";
import { Sparkles, X } from "lucide-react";

export function ProductModal({ productModal, setProductModal, editId, form, setForm, categories, saveProduct }) {
  return productModal && (
        <div className="modal-shade" onMouseDown={(e) => {
          if (e.target === e.currentTarget) setProductModal(false);
        }}>
          <div className="product-modal">
            <div className="modal-head">
              <div>
                <div className="eyebrow"><Sparkles size={12} /> Product details</div>
                <h2>{editId ? "Edit product" : "Add a new product"}</h2>
              </div>
              <button type="button" className="close-btn" onClick={() => setProductModal(false)}><X size={18} /></button>
            </div>

            <form onSubmit={saveProduct} className="product-form">
              <label>Product name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Rose Glow Lip Tint" /></label>
              <div className="form-grid">
                <label>SKU<input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="LIP-009" /></label>
                <label>Category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
              </div>
              <div className="form-grid">
                <label>Shade / Color<input value={form.shade} onChange={(e) => setForm({ ...form, shade: e.target.value })} placeholder="e.g. Berry Rose" /></label>
                <label>Brand<input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Ba'Oré" /></label>
              </div>
              <div className="form-grid">
                <label>Quantity<input type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="0" /></label>
                <label>Unit price (PHP)<input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0.00" /></label>
              </div>
              <div className="form-actions">
                <button type="button" className="secondary-btn" onClick={() => setProductModal(false)}>Cancel</button>
                <button type="submit" className="primary-btn"><Sparkles size={15} /> {editId ? "Save changes" : "Add to inventory"}</button>
              </div>
            </form>
          </div>
        </div>
  );
}
