import React from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  History,
  Users,
} from "lucide-react";

import { categories } from "./lib/constants";
import { money } from "./lib/format";
import { landingPath, protectPath } from "./lib/access";
import { stockStatus, movementDelta, movementLabel, roleLabel } from "./lib/stock";
import { LoginScreen } from "./components/auth/LoginScreen";
import { SessionNotice } from "./components/auth/SessionNotice";
import { Sidebar } from "./components/layout/Sidebar";
import { Toast } from "./components/layout/Toast";
import { Topbar } from "./components/layout/Topbar";
import { AccountModal } from "./components/modals/AccountModal";
import { MovementModal } from "./components/modals/MovementModal";
import { ProductModal } from "./components/modals/ProductModal";
import { DashboardPage } from "./components/pages/DashboardPage";
import { InventoryPage } from "./components/pages/InventoryPage";
import { ActivityPage } from "./components/pages/ActivityPage";
import { TeamPage } from "./components/pages/TeamPage";
import { AppStateProvider, useAppState } from "./state/AppState";

function LoginRoute() {
  const {
    authStatus,
    currentUser,
    username,
    setUsername,
    password,
    setPassword,
    loginError,
    setLoginError,
    loginPending,
    handleLogin,
    toast,
  } = useAppState();

  if (protectPath(authStatus, currentUser?.role ?? null, "/login") === "redirect-dashboard") {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <LoginScreen
      username={username}
      setUsername={setUsername}
      password={password}
      setPassword={setPassword}
      loginError={loginError}
      setLoginError={setLoginError}
      loginPending={loginPending}
      handleLogin={handleLogin}
      toast={toast}
    />
  );
}

function RootRedirect() {
  const { authStatus } = useAppState();
  return <Navigate to={landingPath(authStatus)} replace />;
}

function AdminOnly({ children }) {
  const { authStatus, currentUser } = useAppState();
  const { pathname } = useLocation();
  if (protectPath(authStatus, currentUser?.role ?? null, pathname) !== "allow") {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function AuthBoundary({ children }) {
  const { authStatus, sessionError, retrySessionCheck } = useAppState();
  if (authStatus === "loading" || authStatus === "error") {
    return <SessionNotice status={authStatus} message={sessionError} onRetry={retrySessionCheck} />;
  }
  return children;
}

function AppShell() {
  const { pathname } = useLocation();
  const {
    currentUser,
    isAdmin,
    mobileOpen,
    setMobileOpen,
    goTo,
    handleLogout,
    productModal,
    setProductModal,
    editId,
    form,
    setForm,
    saveProduct,
    productPending,
    movementModal,
    setMovementModal,
    movementForm,
    setMovementForm,
    movementTypes,
    saveMovement,
    movementPending,
    accountModal,
    setAccountModal,
    accountForm,
    setAccountForm,
    saveAccount,
    accountPending,
    accounts,
    toast,
  } = useAppState();

  const activePage = pathname.replace(/^\//, "").split("/")[0] || "dashboard";
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

  return (
    <div className="app-shell">
      <Sidebar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        navItems={navItems}
        activePage={activePage}
        goTo={goTo}
        currentUser={currentUser}
        roleLabel={roleLabel}
        handleLogout={handleLogout}
      />

      <main className="main-area">
        <Topbar
          setMobileOpen={setMobileOpen}
          pageTitle={pageTitle}
          hideBreadcrumb={activePage === "inventory"}
          currentUser={currentUser}
          roleLabel={roleLabel}
        />

        <Outlet />

        <footer className="app-footer"><span>✦</span> Ba'Oré Cosmetics <span>·</span> Made for your beauty business</footer>
      </main>

      <ProductModal
        productModal={productModal}
        setProductModal={setProductModal}
        editId={editId}
        form={form}
        setForm={setForm}
        categories={categories}
        saveProduct={saveProduct}
        productPending={productPending}
      />
      <MovementModal
        movementModal={movementModal}
        setMovementModal={setMovementModal}
        movementForm={movementForm}
        setMovementForm={setMovementForm}
        movementTypes={movementTypes}
        isAdmin={isAdmin}
        saveMovement={saveMovement}
        movementPending={movementPending}
      />
      <AccountModal
        accountModal={accountModal}
        setAccountModal={setAccountModal}
        accountForm={accountForm}
        setAccountForm={setAccountForm}
        saveAccount={saveAccount}
        accountPending={accountPending}
        accounts={accounts}
        currentUser={currentUser}
      />
      <Toast toast={toast} />
    </div>
  );
}

function ProtectedLayout() {
  const { authStatus, currentUser } = useAppState();
  const { pathname } = useLocation();
  const decision = protectPath(authStatus, currentUser?.role ?? null, pathname);
  if (decision === "redirect-login" || decision === "show-login") return <Navigate to="/login" replace />;
  return <AppShell />;
}

function DashboardRoute() {
  const {
    isAdmin,
    displayName,
    openAddProduct,
    items,
    productsStatus,
    productsError,
    movementsStatus,
    movementsError,
    loadProducts,
    totalUnits,
    lowStockItems,
    outOfStockCount,
    inventoryValue,
    goTo,
    myMovements,
  } = useAppState();

  return (
    <DashboardPage
      isAdmin={isAdmin}
      displayName={displayName}
      openAddProduct={openAddProduct}
      items={items}
      productsStatus={productsStatus}
      productsError={productsError}
      movementsStatus={movementsStatus}
      movementsError={movementsError}
      loadProducts={loadProducts}
      totalUnits={totalUnits}
      lowStockItems={lowStockItems}
      outOfStockCount={outOfStockCount}
      inventoryValue={inventoryValue}
      money={money}
      stockStatus={stockStatus}
      goTo={goTo}
      myMovements={myMovements}
      movementDelta={movementDelta}
      movementLabel={movementLabel}
    />
  );
}

function InventoryRoute() {
  const {
    isAdmin,
    openAddProduct,
    items,
    filteredItems,
    search,
    setSearch,
    filter,
    setFilter,
    openMovement,
    openEditProduct,
    deleteProduct,
    productsStatus,
    productsError,
    productPending,
    movementPending,
    loadProducts,
  } = useAppState();

  return (
    <InventoryPage
      isAdmin={isAdmin}
      openAddProduct={openAddProduct}
      items={items}
      money={money}
      filteredItems={filteredItems}
      search={search}
      setSearch={setSearch}
      filter={filter}
      setFilter={setFilter}
      categories={categories}
      stockStatus={stockStatus}
      openMovement={openMovement}
      openEditProduct={openEditProduct}
      deleteProduct={deleteProduct}
      productsStatus={productsStatus}
      productsError={productsError}
      productPending={productPending}
      movementPending={movementPending}
      loadProducts={loadProducts}
    />
  );
}

function ActivityRoute() {
  const { movements, movementsStatus, movementsError, loadProducts, accounts, currentUser } = useAppState();

  return (
    <ActivityPage
      movements={movements}
      movementsStatus={movementsStatus}
      movementsError={movementsError}
      loadMovements={loadProducts}
      accounts={accounts}
      currentUser={currentUser}
      movementDelta={movementDelta}
      movementLabel={movementLabel}
    />
  );
}

function TeamRoute() {
  const {
    openAddAccount,
    accounts,
    accountsStatus,
    accountsError,
    accountPending,
    loadAccounts,
    currentUser,
    openEditAccount,
    openResetPassword,
    removeAccount,
  } = useAppState();

  return (
    <TeamPage
      openAddAccount={openAddAccount}
      accounts={accounts}
      accountsStatus={accountsStatus}
      accountsError={accountsError}
      accountPending={accountPending}
      loadAccounts={loadAccounts}
      roleLabel={roleLabel}
      currentUser={currentUser}
      openEditAccount={openEditAccount}
      openResetPassword={openResetPassword}
      removeAccount={removeAccount}
    />
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/" element={<RootRedirect />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<DashboardRoute />} />
        <Route path="/inventory" element={<InventoryRoute />} />
        <Route path="/activity" element={<AdminOnly><ActivityRoute /></AdminOnly>} />
        <Route path="/team" element={<AdminOnly><TeamRoute /></AdminOnly>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppStateProvider>
        <AuthBoundary>
          <AppRoutes />
        </AuthBoundary>
      </AppStateProvider>
    </BrowserRouter>
  );
}
