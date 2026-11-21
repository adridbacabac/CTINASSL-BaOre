import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  createAccountRequest,
  createProductRequest,
  deleteAccountRequest,
  deleteProductRequest,
  listAccountsRequest,
  listMovementsRequest,
  listMyMovementsRequest,
  listProductsRequest,
  loginRequest,
  logoutRequest,
  recordMovementRequest,
  rememberSession,
  resetAccountPasswordRequest,
  restoreSession,
  retrySession,
  updateAccountRequest,
  updateProductRequest,
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
import { LOW_STOCK, emptyProduct, emptyAccount, employeeMovementTypes, adminMovementTypes } from "../lib/constants";
import {
  applyMovement,
  createProductPayload,
  movementPayload,
  removeProduct,
  sortProducts,
  updateProductPayload,
  upsertProduct,
  validateMovementForm,
  validateProductForm,
} from "../lib/products";

const AppStateContext = createContext(null);

export function AppStateProvider({ children }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [productsStatus, setProductsStatus] = useState("idle");
  const [productsError, setProductsError] = useState("");
  const [productPending, setProductPending] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [accountsStatus, setAccountsStatus] = useState("idle");
  const [accountsError, setAccountsError] = useState("");
  const [accountPending, setAccountPending] = useState(false);
  const [movements, setMovements] = useState([]);
  const [movementsStatus, setMovementsStatus] = useState("idle");
  const [movementsError, setMovementsError] = useState("");
  const [movementPending, setMovementPending] = useState(false);
  const catalogRequest = useRef(0);
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
    localStorage.removeItem("baore-session");
    localStorage.removeItem("baore-users");
    localStorage.removeItem("baore-items");
    localStorage.removeItem("baore-movements");
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

  useEffect(() => {
    if (authStatus !== "authenticated" || !currentUser?.id) {
      catalogRequest.current += 1;
      setItems([]);
      setProductsStatus("idle");
      setProductsError("");
      setMovements([]);
      setMovementsStatus("idle");
      setMovementsError("");
      return;
    }
    loadCatalog(currentUser.role);
  }, [authStatus, currentUser?.id, currentUser?.role]);

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

  async function loadCatalog(role) {
    const requestId = catalogRequest.current + 1;
    catalogRequest.current = requestId;
    setProductsStatus("loading");
    setProductsError("");
    setMovementsStatus("loading");
    setMovementsError("");
    const [productsResult, movementsResult] = await Promise.all([
      listProductsRequest(),
      role === "admin" ? listMovementsRequest() : listMyMovementsRequest(),
    ]);
    if (catalogRequest.current !== requestId) return;
    if (!productsResult.ok) {
      if (await handleSessionFailure(productsResult)) return;
      setProductsStatus("error");
      setProductsError(productsResult.error);
    } else {
      setItems(sortProducts(productsResult.products));
      setProductsStatus("ready");
    }
    if (!movementsResult.ok) {
      if (await handleSessionFailure(movementsResult)) return;
      setMovementsStatus("error");
      setMovementsError(movementsResult.error);
    } else {
      setMovements(movementsResult.movements);
      setMovementsStatus("ready");
    }
  }

  async function handleSessionFailure(result) {
    if (result.status === 401) {
      rememberSession("unauthenticated", null);
      applySession({ status: "unauthenticated", user: null });
      setProductModal(false);
      setMovementModal(null);
      setAccountModal(null);
      setToast("Your session has ended. Sign in again.");
      navigate("/login", { replace: true });
      return true;
    }
    if (result.status === 403) {
      const session = await retrySession();
      applySession(session);
      if (session.status !== "authenticated" || session.user?.role !== currentUser?.role) {
        setProductModal(false);
        setMovementModal(null);
        setAccountModal(null);
        setToast(session.status === "authenticated" ? "Your access has changed." : "Your session has ended. Sign in again.");
        if (session.status !== "authenticated") navigate("/login", { replace: true });
        return true;
      }
    }
    return false;
  }

  function openAddProduct() {
    if (!isAdmin || productsStatus !== "ready") return;
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

  async function saveProduct(event) {
    event.preventDefault();
    if (!isAdmin || productPending) return;
    const mode = editId ? "edit" : "create";
    const problem = validateProductForm(form, mode);
    if (problem) {
      setToast(problem);
      return;
    }
    const current = editId ? items.find((product) => product.id === editId) : null;
    if (mode === "edit" && !current) {
      setToast("Product not found.");
      return;
    }
    const changes = mode === "edit" ? updateProductPayload(form, current) : null;
    if (mode === "edit" && !changes) {
      setProductModal(false);
      setToast("No changes to save.");
      return;
    }
    setProductPending(true);
    try {
      const result = mode === "create"
        ? await createProductRequest(createProductPayload(form))
        : await updateProductRequest(editId, changes);
      if (!result.ok) {
        if (await handleSessionFailure(result)) return;
        setToast(result.error);
        if (result.status === 404 || result.status === 409) loadCatalog(currentUser.role);
        return;
      }
      setItems((prev) => upsertProduct(prev, result.product));
      setForm(emptyProduct);
      setEditId(null);
      setProductModal(false);
      setToast(mode === "create" ? "Product added to inventory." : "Product updated.");
    } finally {
      setProductPending(false);
    }
  }

  async function deleteProduct(item) {
    if (!isAdmin || productPending) return;
    if (!window.confirm(`Delete ${item.name}?`)) return;
    setProductPending(true);
    try {
      const result = await deleteProductRequest(item.id);
      if (!result.ok) {
        if (await handleSessionFailure(result)) return;
        setToast(result.error);
        if (result.status === 404) loadCatalog(currentUser.role);
        return;
      }
      setItems((prev) => removeProduct(prev, item.id));
      setToast("Product deleted.");
    } finally {
      setProductPending(false);
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

  async function saveMovement(event) {
    event.preventDefault();
    if (!movementModal || !currentUser || movementPending) return;
    const problem = validateMovementForm(movementForm, movementTypes);
    if (problem) {
      setToast(problem);
      return;
    }
    const productId = movementModal.id;
    setMovementPending(true);
    try {
      const result = await recordMovementRequest(movementPayload(movementForm, productId));
      if (!result.ok) {
        if (await handleSessionFailure(result)) return;
        setToast(result.error);
        if (result.status === 404 || result.status === 409) loadCatalog(currentUser.role);
        return;
      }
      setItems((prev) => applyMovement(prev, result.movement));
      setMovements((prev) => [result.movement, ...prev.filter((movement) => movement.id !== result.movement.id)]);
      setMovementsStatus("ready");
      setMovementModal(null);
      setToast("Stock movement saved.");
    } finally {
      setMovementPending(false);
    }
  }

  const value = {
    items,
    productsStatus,
    productsError,
    productPending,
    loadProducts: () => loadCatalog(currentUser?.role),
    accounts,
    accountsStatus,
    accountsError,
    accountPending,
    loadAccounts,
    movements,
    movementsStatus,
    movementsError,
    movementPending,
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
