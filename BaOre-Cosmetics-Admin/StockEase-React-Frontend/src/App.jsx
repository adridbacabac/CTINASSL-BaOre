import React, { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Package,
  Plus,
  Search,
  Pencil,
  Trash2,
  AlertTriangle,
  Sparkles,
  Menu,
  X,
  Boxes,
  CircleDollarSign,
  ChevronRight,
  Heart,
  Droplets,
  ShieldCheck,
  Eye,
} from "lucide-react";

const starterItems = [
  { id: 1, name: "Velvet Matte Lipstick", category: "Lips", sku: "LIP-001", quantity: 28, price: 399, brand: "Ba'Oré", shade: "Rosewood" },
  { id: 2, name: "Dewy Glow Foundation", category: "Face", sku: "FAC-002", quantity: 16, price: 699, brand: "Ba'Oré", shade: "Warm Beige" },
  { id: 3, name: "Cloud Nine Blush", category: "Cheeks", sku: "CHK-003", quantity: 4, price: 349, brand: "Ba'Oré", shade: "Soft Peach" },
  { id: 4, name: "Lash Muse Mascara", category: "Eyes", sku: "EYE-004", quantity: 22, price: 429, brand: "Ba'Oré", shade: "Jet Black" },
  { id: 5, name: "Silk Touch Setting Powder", category: "Face", sku: "FAC-005", quantity: 3, price: 499, brand: "Ba'Oré", shade: "Translucent" },
  { id: 6, name: "Petal Shine Lip Gloss", category: "Lips", sku: "LIP-006", quantity: 35, price: 299, brand: "Ba'Oré", shade: "Pink Quartz" },
  { id: 7, name: "Starlit Eyeshadow Palette", category: "Eyes", sku: "EYE-007", quantity: 12, price: 899, brand: "Ba'Oré", shade: "Moonlight" },
  { id: 8, name: "Sculpt & Define Contour", category: "Cheeks", sku: "CHK-008", quantity: 7, price: 549, brand: "Ba'Oré", shade: "Toffee" },
];

const categories = ["Face", "Eyes", "Lips", "Cheeks", "Tools & Brushes", "Skincare"];
const emptyProduct = { name: "", category: "Face", sku: "", quantity: "", price: "", brand: "Ba'Oré", shade: "" };
const money = (value) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(Number(value) || 0);

function readStorage(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    return JSON.parse(stored);
  } catch {
    return fallback;
  }
}

export default function App() {
  const [items, setItems] = useState(() => readStorage("baore-items", starterItems));
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All categories");
  const [productModal, setProductModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyProduct);
  const [toast, setToast] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentUser = { id: "admin-1", name: "Store Admin", role: "admin" };

  useEffect(() => {
    localStorage.setItem("baore-items", JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const lowStockItems = items.filter((item) => Number(item.quantity) <= 5);
  const totalUnits = items.reduce((sum, item) => sum + Number(item.quantity), 0);
  const inventoryValue = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.price), 0);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesFilter = filter === "All categories" || item.category === filter;
      const haystack = `${item.name} ${item.sku} ${item.category} ${item.shade}`.toLowerCase();
      return matchesFilter && haystack.includes(search.toLowerCase());
    });
  }, [items, filter, search]);

  function openAddProduct() {
    setEditId(null);
    setForm(emptyProduct);
    setProductModal(true);
  }

  function openEditProduct(item) {
    setEditId(item.id);
    setForm({
      name: item.name,
      category: item.category,
      sku: item.sku,
      quantity: String(item.quantity),
      price: String(item.price),
      brand: item.brand,
      shade: item.shade || "",
    });
    setProductModal(true);
  }

  function saveProduct(event) {
    event.preventDefault();
    const item = { ...form, name: form.name.trim(), sku: form.sku.trim().toUpperCase(), quantity: Number(form.quantity), price: Number(form.price) };

    if (!item.name || !item.sku || form.quantity === "" || form.price === "") {
      setToast("Please complete all required fields.");
      return;
    }

    if (item.quantity < 0 || item.price < 0 || !Number.isFinite(item.quantity) || !Number.isFinite(item.price)) {
      setToast("Enter valid quantity and price.");
      return;
    }

    const duplicateSku = items.some((product) => product.sku.toLowerCase() === item.sku.toLowerCase() && product.id !== editId);
    if (duplicateSku) {
      setToast("That SKU already exists.");
      return;
    }

    setItems((prev) => {
      if (editId) {
        return prev.map((product) => (product.id === editId ? { ...item, id: editId } : product));
      }
      return [{ ...item, id: Date.now() }, ...prev];
    });

    setProductModal(false);
    setToast(editId ? "Product updated." : "Product added to inventory.");
  }

  function deleteProduct(item) {
    if (window.confirm(`Delete ${item.name}?`)) {
      setItems((prev) => prev.filter((product) => product.id !== item.id));
      setToast("Product deleted.");
    }
  }

  const navItems = [
    { name: "Dashboard", icon: LayoutDashboard },
    { name: "Inventory", icon: Package },
  ];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Sparkles size={21} /></div>
          <div className="brand-name">
            <strong>Ba'Oré</strong>
            <span>C O S M E T I C S</span>
          </div>
          <button className="close-nav" type="button" onClick={() => setMobileOpen(false)}><X size={18} /></button>
        </div>

        <div className="store-tag"><span className="tiny-star">✦</span> BEAUTY, BOTTLED</div>

        <div className="nav-caption">MAIN MENU</div>
        {navItems.map((item) => (
          <button key={item.name} type="button" className="nav-link selected">
            <item.icon size={18} />
            <span>{item.name}</span>
            <ChevronRight size={15} className="nav-arrow" />
          </button>
        ))}

        <div className="sidebar-spacer" />

        <div className="side-promo">
          <div className="promo-spark"><Sparkles size={18} /></div>
          <strong>A little sparkle goes a long way.</strong>
          <p>Keep your beauty stock blooming.</p>
          <button type="button" onClick={openAddProduct}>Add a product <Plus size={14} /></button>
        </div>

        <div className="admin-profile">
          <div className="admin-avatar">{(currentUser?.name || "U").charAt(0).toUpperCase()}</div>
          <div>
            <strong>{currentUser?.name || "User"}</strong>
            <span>Administrator</span>
          </div>
        </div>
      </aside>

      {mobileOpen && <button className="mobile-shade" type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu" />}

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-toggle" type="button" onClick={() => setMobileOpen(true)}><Menu size={18} /></button>
          <div className="crumb">Ba'Oré Cosmetics <span>/</span> <b>Dashboard</b></div>
          <div className="top-actions">
            <span className="live-dot" />
            <span>Store system active</span>
            <div className="top-avatar">{(currentUser.name || "U").charAt(0).toUpperCase()}</div>
          </div>
        </header>

        <section className="welcome-row">
          <div>
            <div className="eyebrow"><Sparkles size={12} /> Your beauty business at a glance</div>
            <h1>Good day, Admin</h1>
            <p className="muted">Here’s the latest glow-up of your store inventory.</p>
          </div>
          <button type="button" className="primary-btn" onClick={openAddProduct}><Plus size={16} /> Add product</button>
        </section>

        <section className="hero-banner">
          <div className="hero-copy">
            <div className="hero-kicker">The Ba'Oré edit</div>
            <h2>Beauty begins with being stocked.</h2>
            <p>Keep your stock, customer stories, and product shelves aligned in one chic workspace.</p>
            <button type="button" onClick={() => document.getElementById("inventory-section")?.scrollIntoView({ behavior: "smooth" })}>Explore inventory <ChevronRight size={15} /></button>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="orb orb-one" />
            <div className="orb orb-two" />
            <div className="glow-bubble" />
            <div className="jar jar-one"><span>BA'ORÉ</span></div>
            <div className="jar jar-two"><span>GLOW</span></div>
          </div>
        </section>

        <section className="stats-grid">
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
          <article className="stat-card">
            <div className="stat-label">Inventory value <span className="icon-box lilac"><CircleDollarSign size={18} /></span></div>
            <div className="stat-value money-value">{money(inventoryValue)}</div>
            <div className="stat-foot">Total value at selling price</div>
          </article>
        </section>

        <section className="dashboard-grid">
          <div className="content-card">
            <div className="card-head">
              <div>
                <h3>Recently in your collection</h3>
                <p>A quick look at your beauty shelf.</p>
              </div>
              <button type="button" className="text-link" onClick={() => document.getElementById("inventory-section")?.scrollIntoView({ behavior: "smooth" })}>View inventory <ChevronRight size={14} /></button>
            </div>
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
                  <span className={`stock-pill ${item.quantity <= 5 ? "low" : "ok"}`}>{item.quantity <= 5 ? "Low stock" : "In stock"}</span>
                </div>
              ))}
            </div>
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

            <button type="button" className="restock-btn" onClick={() => document.getElementById("inventory-section")?.scrollIntoView({ behavior: "smooth" })}>Manage stock <ChevronRight size={14} /></button>
          </div>
        </section>

        <section className="page-title" id="inventory-section">
          <div>
            <div className="eyebrow"><Sparkles size={12} /> your beauty collection</div>
            <h1>Product Inventory</h1>
            <p className="muted">Manage every lipstick, palette, and beauty essential.</p>
          </div>
          <button type="button" className="primary-btn" onClick={openAddProduct}><Plus size={16} /> Add product</button>
        </section>

        <section className="inventory-summary">
          <div><span>Products listed</span><b>{items.length}</b></div>
          <div><span>Total units</span><b>{totalUnits}</b></div>
          <div><span>Low stock alerts</span><b className="warn-text">{lowStockItems.length}</b></div>
          <div><span>Inventory value</span><b>{money(inventoryValue)}</b></div>
        </section>

        <section className="content-card inventory-card">
          <div className="card-head">
            <div>
              <h3>All products</h3>
              <p>Your complete Ba'Oré cosmetics catalogue.</p>
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
                    <td><span className={`stock-pill ${item.quantity <= 5 ? "low" : "ok"}`}>{item.quantity <= 5 ? "Low stock" : "In stock"}</span></td>
                    <td>
                      <div className="action-group">
                        <button type="button" onClick={() => openEditProduct(item)}><Pencil size={15} /></button>
                        <button type="button" className="danger" onClick={() => deleteProduct(item)}><Trash2 size={15} /></button>
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
                <span>Try another search or add a new product.</span>
              </div>
            )}
          </div>

          <div className="table-footer">
            <span>Showing <b>{filteredItems.length}</b> of <b>{items.length}</b> products</span>
            <span><span className="live-dot" /> Inventory changes are saved automatically</span>
          </div>
        </section>

        <footer className="app-footer"><span>✦</span> Ba'Oré Cosmetics <span>·</span> Made for your beauty business</footer>
      </main>

      {productModal && (
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
      )}

      {toast && <div className="toast"><Sparkles size={15} /> {toast}</div>}
    </div>
  );
}
