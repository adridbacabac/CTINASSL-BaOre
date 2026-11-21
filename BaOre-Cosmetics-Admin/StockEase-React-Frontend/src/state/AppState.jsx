import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  createAccountRequest,
  deleteAccountRequest,
  listAccountsRequest,
  loginRequest,
  logoutRequest,
  rememberSession,
  resetAccountPasswordRequest,
  restoreSession,
  retrySession,
  updateAccountRequest,
} from "../lib/api";
import {
  accountFormFor,
  createPayload,
  deleteBlockReason,
  movementBelongsTo,
  removeAccountFrom,
  roleLockReason,
  updatePayload,
  upsertAccount,
  validateAccountForm,
} from "../lib/accounts";
import { starterItems } from "../data/starterData";
import { LOW_STOCK, emptyProduct, emptyAccount, employeeMovementTypes, adminMovementTypes } from "../lib/constants";
import { movementDelta } from "../lib/stock";
import { readStorage } from "../lib/storage";

const AppStateContext = createContext(null);

export function AppStateProvider({ children }) {
  const navigate = useNavigate();
  const [items, setItems] = useState(() => readStorage("baore-items", starterItems));
  const [accounts, setAccounts] = useState([]);
  const [accountsStatus, setAccountsStatus] = useState("idle");
  const [accountsError, setAccountsError] = useState("");
  const [accountPending, setAccountPending] = useState(false);
  const [movements, setMovements] = useState(() => readStorage("baore-movements", []));
  const [authStatus, setAuthStatus] = useState("loading");
  const [currentUser, setCurrentUser] = useState(null);
  const [sessionError, setSessionError] = useState("");
  const [loginPending, setLoginPending] = useState(false);
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
  const [accountModal, setAccountModal] = useState(null);
  const [accountForm, setAccountForm] = useState(emptyAccount);
  const [toast, setToast] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = currentUser?.role === "admin";
  const displayName = currentUser?.name || "there";
  const movementTypes = isAdmin ? adminMovementTypes : employeeMovementTypes;

  useEffect(() => {
    localStorage.setItem("baore-items", JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem("baore-movements", JSON.stringify(movements));
  }, [movements]);

  useEffect(() => {
    localStorage.removeItem("baore-session");
    localStorage.removeItem("baore-users");
    let active = true;
    restoreSession().then((result) => {
      if (!active) return;
      applySession(result);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  function applySession(result) {
    if (result.status === "authenticated" && result.user) {
      setCurrentUser(result.user);
      setAuthStatus("authenticated");
      setSessionError("");
      return;
    }
    if (result.status === "unauthenticated") {
      setCurrentUser(null);
      setAuthStatus("unauthenticated");
      setSessionError("");
      return;
    }
    setAuthStatus("error");
    setSessionError(result.message || "The store server could not be reached. Try again.");
  }

  useEffect(() => {
    if (authStatus === "authenticated" && isAdmin) {
      loadAccounts();
      return;
    }
    setAccounts([]);
    setAccountsStatus("idle");
    setAccountsError("");
  }, [authStatus, isAdmin, currentUser?.id]);

  const lowStockItems = items.filter((item) => Number(item.quantity) <= LOW_STOCK);
  const myMovements = movements.filter((movement) => movementBelongsTo(movement, currentUser));
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

  async function handleLogin(event) {
    event.preventDefault();
    if (loginPending) return;
    setLoginPending(true);
    setLoginError("");
    try {
      const result = await loginRequest(username, password);
      if (!result.ok) {
        setLoginError(result.error);
        return;
      }
      rememberSession("authenticated", result.user);
      applySession({ status: "authenticated", user: result.user });
      setPassword("");
      setToast(`Welcome back, ${result.user.name}.`);
      navigate("/dashboard", { replace: true });
    } finally {
      setLoginPending(false);
    }
  }

  async function retrySessionCheck() {
    setAuthStatus("loading");
    setSessionError("");
    applySession(await retrySession());
  }

  async function handleLogout() {
    const result = await logoutRequest();
    if (!result.ok) {
      setToast(result.error);
      return;
    }
    rememberSession("unauthenticated", null);
    applySession({ status: "unauthenticated", user: null });
    setUsername("");
    setPassword("");
    setLoginError("");
    setMobileOpen(false);
    setProductModal(false);
    setMovementModal(null);
    setAccountModal(null);
    navigate("/login", { replace: true });
  }

  async function loadAccounts() {
    setAccountsStatus("loading");
    setAccountsError("");
    const result = await listAccountsRequest();
    if (!result.ok) {
      if (await handleAccountRejection(result)) return;
      setAccountsStatus("error");
      setAccountsError(result.error);
      return;
    }
    setAccounts(result.accounts);
    setAccountsStatus("ready");
  }

  // Returns true when the session itself changed and the caller should stop.
  async function handleAccountRejection(result) {
    if (result.status === 401) {
      rememberSession("unauthenticated", null);
      applySession({ status: "unauthenticated", user: null });
      setAccountModal(null);
      setToast("Your session has ended. Sign in again.");
      navigate("/login", { replace: true });
      return true;
    }
    if (result.status === 403) {
      const session = await retrySession();
      applySession(session);
      if (session.status === "authenticated" && session.user?.role !== "admin") {
        setAccountModal(null);
        setToast("Your account no longer has admin access.");
        return true;
      }
    }
    return false;
  }

  async function reportAccountFailure(result) {
    if (await handleAccountRejection(result)) return;
    setToast(result.error);
    if (result.status === 404 || result.status === 409) loadAccounts();
  }

  function openAddAccount() {
    if (!isAdmin) return;
    setAccountForm(emptyAccount);
    setAccountModal({ mode: "create", account: null });
  }

  function openEditAccount(account) {
    if (!isAdmin) return;
    setAccountForm(accountFormFor(account));
    setAccountModal({ mode: "edit", account });
  }

  function openResetPassword(account) {
    if (!isAdmin) return;
    setAccountForm({ ...accountFormFor(account), password: "" });
    setAccountModal({ mode: "password", account });
  }

  async function saveAccount(event) {
    event.preventDefault();
    if (!isAdmin || !accountModal || accountPending) return;
    const { mode, account } = accountModal;
    const problem = validateAccountForm(accountForm, mode);
    if (problem) {
      setToast(problem);
      return;
    }

    let request;
    let success;
    if (mode === "create") {
      request = () => createAccountRequest(createPayload(accountForm));
      success = "Account added.";
    } else if (mode === "edit") {
      if (accountForm.role !== account.role && roleLockReason(account, accounts, currentUser)) {
        setToast(roleLockReason(account, accounts, currentUser));
        return;
      }
      const changes = updatePayload(accountForm, account);
      if (!changes) {
        setAccountModal(null);
        setToast("No changes to save.");
        return;
      }
      request = () => updateAccountRequest(account.id, changes);
      success = "Account updated.";
    } else {
      request = () => resetAccountPasswordRequest(account.id, accountForm.password);
      success = `Password reset. ${account.name} was signed out of other sessions.`;
    }

    setAccountPending(true);
    try {
      const result = await request();
      if (!result.ok) {
        await reportAccountFailure(result);
        return;
      }
      setAccounts((prev) => upsertAccount(prev, result.account));
      if (result.account.id === currentUser?.id) {
        const { createdAt, ...profile } = result.account;
        setCurrentUser(profile);
        rememberSession("authenticated", profile);
      }
      setAccountForm(emptyAccount);
      setAccountModal(null);
      setToast(success);
    } finally {
      setAccountPending(false);
    }
  }

  async function removeAccount(account) {
    if (!isAdmin || accountPending) return;
    const blocked = deleteBlockReason(account, accounts, currentUser);
    if (blocked) {
      setToast(blocked);
      return;
    }
    if (!window.confirm(`Remove ${account.name}?`)) return;
    setAccountPending(true);
    try {
      const result = await deleteAccountRequest(account.id);
      if (!result.ok) {
        await reportAccountFailure(result);
        return;
      }
      setAccounts((prev) => removeAccountFrom(prev, account.id));
      setToast("Account removed.");
    } finally {
      setAccountPending(false);
    }
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
    accounts,
    accountsStatus,
    accountsError,
    accountPending,
    loadAccounts,
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
    authStatus,
    sessionError,
    loginPending,
    retrySessionCheck,
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
    openEditAccount,
    openResetPassword,
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
