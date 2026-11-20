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
  LogOut,
  History,
  Users,
  ClipboardList,
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
const emptyAccount = { name: "", email: "", username: "", password: "", role: "user" };
const LOW_STOCK = 5;
const money = (value) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(Number(value) || 0);

const starterUsers = [
  { id: "admin-1", name: "Admin One", email: "admin@baore.com", username: "admin", password: "baore-admin", role: "admin" },
  { id: "user-1", name: "User One", email: "user@baore.com", username: "employee", password: "baore-staff", role: "user" },
];

const employeeMovementTypes = [
  { id: "sale", label: "Sale" },
  { id: "return", label: "Return" },
];

const adminMovementTypes = [
  { id: "restock", label: "Restock" },
  { id: "sale", label: "Sale" },
  { id: "adjustment", label: "Adjustment" },
  { id: "return", label: "Return" },
];

function stockStatus(quantity) {
  const qty = Number(quantity);
  if (qty <= 0) return { label: "Out of stock", className: "out" };
  if (qty <= LOW_STOCK) return { label: "Low stock", className: "low" };
  return { label: "In stock", className: "ok" };
}

function movementDelta(movement) {
  if (movement.type === "sale") return -Number(movement.quantity);
  if (movement.type === "restock" || movement.type === "return") return Number(movement.quantity);
  return movement.direction === "out" ? -Number(movement.quantity) : Number(movement.quantity);
}

function roleLabel(role) {
  return role === "admin" ? "Admin" : "User";
}

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

function readSession() {
  try {
    return JSON.parse(localStorage.getItem("baore-session") || "null");
  } catch {
    return null;
  }
}

export default function App() {
  const [items, setItems] = useState(() => readStorage("baore-items", starterItems));
  const [users, setUsers] = useState(() => {
    const stored = readStorage("baore-users", starterUsers);
    const list = Array.isArray(stored) ? [...stored] : [];
    starterUsers.forEach((account) => {
      const exists = list.some((user) => user.id === account.id || user.username.toLowerCase() === account.username.toLowerCase());
      if (!exists) list.push(account);
    });
    return list;
  });
  const [movements, setMovements] = useState(() => readStorage("baore-movements", []));
  const [sessionUserId, setSessionUserId] = useState(readSession);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [page, setPage] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All categories");
  const [productModal, setProductModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyProduct);
  const [movementModal, setMovementModal] = useState(null);
  const [movementForm, setMovementForm] = useState({ type: "sale", quantity: "", note: "", direction: "out" });
  const [accountModal, setAccountModal] = useState(false);
  const [accountForm, setAccountForm] = useState(emptyAccount);
  const [toast, setToast] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentUser = users.find((user) => user.id === sessionUserId) || null;
  const isAdmin = currentUser?.role === "admin";
  const activePage = !isAdmin && (page === "activity" || page === "team") ? "dashboard" : page;
  const displayName = currentUser?.name || "there";
  const movementTypes = isAdmin ? adminMovementTypes : employeeMovementTypes;

  useEffect(() => {
    localStorage.setItem("baore-items", JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem("baore-users", JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem("baore-movements", JSON.stringify(movements));
  }, [movements]);

  useEffect(() => {
    if (sessionUserId && !users.some((user) => user.id === sessionUserId)) {
      setSessionUserId(null);
      localStorage.removeItem("baore-session");
    }
  }, [sessionUserId, users]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const lowStockItems = items.filter((item) => Number(item.quantity) <= LOW_STOCK);
  const myMovements = movements.filter((movement) => movement.userId === currentUser?.id);
  const totalUnits = items.reduce((sum, item) => sum + Number(item.quantity), 0);
  const inventoryValue = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.price), 0);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesFilter = filter === "All categories" || item.category === filter;
      const haystack = `${item.name} ${item.sku} ${item.category} ${item.shade}`.toLowerCase();
      return matchesFilter && haystack.includes(search.toLowerCase());
    });
  }, [items, filter, search]);

  function goTo(nextPage) {
    setPage(nextPage);
    setMobileOpen(false);
  }

  function handleLogin(event) {
    event.preventDefault();
    const match = users.find((user) => user.username.toLowerCase() === username.trim().toLowerCase() && user.password === password);
    if (!match) {
      setLoginError("Those sign-in details don’t match a store account.");
      return;
    }
    setLoginError("");
    setSessionUserId(match.id);
    localStorage.setItem("baore-session", JSON.stringify(match.id));
    setPage("dashboard");
    setPassword("");
    setToast(`Welcome back, ${match.name}.`);
  }

  function handleLogout() {
    setSessionUserId(null);
    localStorage.removeItem("baore-session");
    setUsername("");
    setPassword("");
    setLoginError("");
    setPage("dashboard");
    setMobileOpen(false);
    setProductModal(false);
    setMovementModal(null);
    setAccountModal(false);
  }

  function openAddAccount() {
    if (!isAdmin) return;
    setAccountForm(emptyAccount);
    setAccountModal(true);
  }

  function saveAccount(event) {
    event.preventDefault();
    if (!isAdmin) return;
    const account = {
      name: accountForm.name.trim(),
      email: accountForm.email.trim(),
      username: accountForm.username.trim(),
      password: accountForm.password,
      role: accountForm.role === "admin" ? "admin" : "user",
    };

    if (!account.name || !account.email || !account.username || !account.password) {
      setToast("Please complete all account fields.");
      return;
    }

    if (!account.email.includes("@")) {
      setToast("Enter a valid email.");
      return;
    }

    const duplicate = users.some((user) => user.username.toLowerCase() === account.username.toLowerCase() || user.email.toLowerCase() === account.email.toLowerCase());
    if (duplicate) {
      setToast("That username or email is already in use.");
      return;
    }

    setUsers((prev) => [
      ...prev,
      { ...account, id: `user-${Date.now()}`, createdAt: new Date().toISOString() },
    ]);
    setAccountModal(false);
    setToast("Account added.");
  }

  function removeAccount(user) {
    if (!isAdmin || user.id === currentUser?.id) return;
    const adminsLeft = users.filter((account) => account.role === "admin" && account.id !== user.id).length;
    if (user.role === "admin" && adminsLeft === 0) {
      setToast("Keep at least one admin account.");
      return;
    }
    if (!window.confirm(`Remove ${user.name}?`)) return;
    setUsers((prev) => prev.filter((account) => account.id !== user.id));
    setToast("Account removed.");
  }

  function openAddProduct() {
    if (!isAdmin) return;
    setEditId(null);
    setForm(emptyProduct);
    setProductModal(true);
  }

  function openEditProduct(item) {
    if (!isAdmin) return;
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
    if (!isAdmin) return;
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
    if (!isAdmin) return;
    if (window.confirm(`Delete ${item.name}?`)) {
      setItems((prev) => prev.filter((product) => product.id !== item.id));
      setToast("Product deleted.");
    }
  }

  function openMovement(item) {
    setMovementModal(item);
    setMovementForm({
      type: isAdmin ? "restock" : "sale",
      quantity: "",
      note: "",
      direction: "out",
    });
  }

  function saveMovement(event) {
    event.preventDefault();
    if (!movementModal || !currentUser) return;
    const allowed = movementTypes.some((type) => type.id === movementForm.type);
    const amount = Number(movementForm.quantity);
    if (!allowed || !Number.isInteger(amount) || amount <= 0) {
      setToast("Enter a whole number of units.");
      return;
    }

    const delta = movementDelta({ ...movementForm, quantity: amount });
    const nextQty = Number(movementModal.quantity) + delta;
    if (nextQty < 0) {
      setToast("That would take stock below zero.");
      return;
    }

    setItems((prev) => prev.map((product) => (product.id === movementModal.id ? { ...product, quantity: nextQty } : product)));
    setMovements((prev) => [
      {
        id: Date.now(),
        productId: movementModal.id,
        type: movementForm.type,
        quantity: amount,
        direction: movementForm.type === "adjustment" ? movementForm.direction : undefined,
        note: movementForm.note.trim(),
        userId: currentUser.id,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setMovementModal(null);
    setToast("Stock movement saved.");
  }

  const navItems = [
    { name: "Dashboard", id: "dashboard", icon: LayoutDashboard },
    { name: isAdmin ? "Inventory" : "Floor stock", id: "inventory", icon: Package },
    ...(isAdmin
      ? [
          { name: "Activity", id: "activity", icon: History },
          { name: "Team", id: "team", icon: Users },
        ]
      : []),
  ];

  const pageTitle = {
    dashboard: "Dashboard",
    inventory: isAdmin ? "Inventory" : "Floor stock",
    activity: "Activity",
    team: "Team",
  }[activePage];

  if (!currentUser) {
    return (
      <div className="auth-shell">
        <div className="auth-panel auth-panel-solo">
          <section className="auth-card">
            <form className="auth-form" onSubmit={handleLogin}>
              <div className="eyebrow"><Sparkles size={12} /> Store sign in</div>
              <h2>Welcome back</h2>
              <p className="muted">Use your store username. The account role opens the tools you need.</p>
              <label>
                Username
                <input
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setLoginError(""); }}
                  placeholder="admin"
                  autoComplete="username"
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setLoginError(""); }}
                  placeholder="Your password"
                  autoComplete="current-password"
                />
              </label>
              {loginError && <p className="form-error">{loginError}</p>}
              <button type="submit" className="primary-btn auth-submit">Sign in <ChevronRight size={16} /></button>
            </form>
          </section>
        </div>
        {toast && <div className="toast"><Sparkles size={15} /> {toast}</div>}
      </div>
    );
  }

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
          <button key={item.id} type="button" className={`nav-link ${activePage === item.id ? "selected" : ""}`} onClick={() => goTo(item.id)}>
            <item.icon size={18} />
            <span>{item.name}</span>
            <ChevronRight size={15} className="nav-arrow" />
          </button>
        ))}

        <div className="sidebar-spacer" />

        <div className="admin-profile">
          <div className="admin-avatar">{(currentUser.name || "U").charAt(0).toUpperCase()}</div>
          <div>
            <strong>{currentUser.name}</strong>
            <span>{roleLabel(currentUser.role)}</span>
          </div>
          <button type="button" className="logout-btn" onClick={handleLogout} aria-label="Sign out"><LogOut size={15} /></button>
        </div>
      </aside>

      {mobileOpen && <button className="mobile-shade" type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu" />}

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-toggle" type="button" onClick={() => setMobileOpen(true)}><Menu size={18} /></button>
          <div className="crumb">Ba'Oré Cosmetics <span>/</span> <b>{pageTitle}</b></div>
          <div className="top-actions">
            <span className="live-dot" />
            <span>{roleLabel(currentUser.role)} session</span>
            <div className="top-avatar">{(currentUser.name || "U").charAt(0).toUpperCase()}</div>
          </div>
        </header>

        {activePage === "dashboard" && (
        <>
        <section className="welcome-row">
          <div>
            <div className="eyebrow"><Sparkles size={12} /> {isAdmin ? "Your beauty business at a glance" : "Your shift at a glance"}</div>
            <h1>Good day, {displayName}</h1>
            <p className="muted">{isAdmin ? "Here’s the latest glow-up of your store inventory." : "Check the shelf, catch low stock, and record what leaves the counter."}</p>
          </div>
          {isAdmin && <button type="button" className="primary-btn" onClick={openAddProduct}><Plus size={16} /> Add product</button>}
        </section>

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
                <p>Sales and returns recorded on your account.</p>
              </div>
            </div>
            {myMovements.length ? (
              <div className="list-stack">
                {myMovements.slice(0, 5).map((movement) => {
                  const product = items.find((item) => item.id === movement.productId);
                  const delta = movementDelta(movement);
                  return (
                    <div className="low-row" key={movement.id}>
                      <div>
                        <strong>{product?.name || "Removed product"}</strong>
                        <span>{movement.type} · {movement.note || "No note"}</span>
                      </div>
                      <b className={delta < 0 ? "warn-text" : ""}>{delta > 0 ? `+${delta}` : delta}</b>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="all-good"><ClipboardList size={24} /> <strong>Nothing recorded yet</strong> <span>Sales and returns you save will show up here.</span></div>
            )}
          </section>
        )}
        </>
        )}

        {activePage === "inventory" && (
        <>
        <section className="page-title" id="inventory-section">
          <div>
            <div className="eyebrow"><Sparkles size={12} /> your beauty collection</div>
            <h1>{isAdmin ? "Product Inventory" : "Floor stock"}</h1>
            <p className="muted">{isAdmin ? "Manage every lipstick, palette, and beauty essential." : "Search the shelf and record sales or returns. Catalogue changes stay with your manager."}</p>
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
                        <button type="button" title={isAdmin ? "Update stock" : "Record sale or return"} onClick={() => openMovement(item)}><ClipboardList size={15} /></button>
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
        )}

        {activePage === "activity" && isAdmin && (
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
                          <td><span className="category-tag">{movement.type}</span></td>
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
        )}

        {activePage === "team" && isAdmin && (
          <section className="content-card inventory-card page-block">
            <div className="card-head">
              <div>
                <div className="eyebrow"><Sparkles size={12} /> store accounts</div>
                <h3>Team</h3>
                <p>Add or remove an account, and choose Admin or User access.</p>
              </div>
              <button type="button" className="primary-btn" onClick={openAddAccount}><Plus size={16} /> Add account</button>
            </div>
            <div className="list-stack">
              {users.map((user) => (
                <div className="list-row" key={user.id}>
                  <div className="admin-avatar">{user.name.charAt(0)}</div>
                  <div className="row-copy">
                    <strong>{user.name}</strong>
                    <span>{user.email} · {user.username}</span>
                  </div>
                  <span className={user.role === "admin" ? "stock-pill ok" : "category-tag"}>{roleLabel(user.role)}</span>
                  {user.id !== currentUser.id && (
                    <button type="button" className="danger icon-btn" title="Remove account" aria-label={`Remove ${user.name}`} onClick={() => removeAccount(user)}><Trash2 size={15} /></button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

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

      {movementModal && (
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
                <input value={movementForm.note} onChange={(e) => setMovementForm({ ...movementForm, note: e.target.value })} placeholder={isAdmin ? "New shipment, count fix..." : "Counter sale, customer return..."} />
              </label>
              <div className="form-actions">
                <button type="button" className="secondary-btn" onClick={() => setMovementModal(null)}>Cancel</button>
                <button type="submit" className="primary-btn"><Sparkles size={15} /> Save movement</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {accountModal && (
        <div className="modal-shade" onMouseDown={(e) => {
          if (e.target === e.currentTarget) setAccountModal(false);
        }}>
          <div className="product-modal">
            <div className="modal-head">
              <div>
                <div className="eyebrow"><Users size={12} /> Store access</div>
                <h2>Add an account</h2>
              </div>
              <button type="button" className="close-btn" onClick={() => setAccountModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={saveAccount} className="product-form">
              <label>Name<input value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} placeholder="Full name" /></label>
              <div className="form-grid">
                <label>Email<input type="email" value={accountForm.email} onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })} placeholder="name@baore.com" /></label>
                <label>Username<input value={accountForm.username} onChange={(e) => setAccountForm({ ...accountForm, username: e.target.value })} placeholder="username" autoComplete="off" /></label>
              </div>
              <div className="form-grid">
                <label>Password<input type="password" value={accountForm.password} onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })} placeholder="Password" autoComplete="new-password" /></label>
                <label>
                  Access
                  <select value={accountForm.role} onChange={(e) => setAccountForm({ ...accountForm, role: e.target.value })}>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
              </div>
              <div className="form-actions">
                <button type="button" className="secondary-btn" onClick={() => setAccountModal(false)}>Cancel</button>
                <button type="submit" className="primary-btn"><Plus size={15} /> Add account</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <div className="toast"><Sparkles size={15} /> {toast}</div>}
    </div>
  );
}
