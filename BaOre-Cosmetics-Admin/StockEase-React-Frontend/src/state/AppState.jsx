import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { starterItems, starterUsers } from "../data/starterData";
import { LOW_STOCK, emptyProduct, emptyAccount, employeeMovementTypes, adminMovementTypes } from "../lib/constants";
import { movementDelta } from "../lib/stock";
import { readStorage, readSession } from "../lib/storage";

const AppStateContext = createContext(null);

export function AppStateProvider({ children }) {
  const navigate = useNavigate();
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
    navigate(`/${nextPage}`);
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
    setPassword("");
    setToast(`Welcome back, ${match.name}.`);
    navigate("/dashboard", { replace: true });
  }

  function handleLogout() {
    setSessionUserId(null);
    localStorage.removeItem("baore-session");
    setUsername("");
    setPassword("");
    setLoginError("");
    setMobileOpen(false);
    setProductModal(false);
    setMovementModal(null);
    setAccountModal(false);
    navigate("/login", { replace: true });
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
      type: isAdmin ? "restock" : "stock_out",
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

  const value = {
    items,
    users,
    movements,
    username,
    setUsername,
    password,
    setPassword,
    loginError,
    setLoginError,
    search,
    setSearch,
    filter,
    setFilter,
    productModal,
    setProductModal,
    editId,
    form,
    setForm,
    movementModal,
    setMovementModal,
    movementForm,
    setMovementForm,
    accountModal,
    setAccountModal,
    accountForm,
    setAccountForm,
    toast,
    mobileOpen,
    setMobileOpen,
    currentUser,
    isAdmin,
    displayName,
    movementTypes,
    lowStockItems,
    myMovements,
    totalUnits,
    inventoryValue,
    filteredItems,
    goTo,
    handleLogin,
    handleLogout,
    openAddAccount,
    saveAccount,
    removeAccount,
    openAddProduct,
    openEditProduct,
    saveProduct,
    deleteProduct,
    openMovement,
    saveMovement,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const value = useContext(AppStateContext);
  if (!value) {
    throw new Error("useAppState must be used inside AppStateProvider");
  }
  return value;
}
