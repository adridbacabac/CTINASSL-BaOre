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
import { stockStatus, movementDelta, movementLabel, roleLabel } from "./lib/stock";
import { LoginScreen } from "./components/auth/LoginScreen";
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
    currentUser,
    username,
    setUsername,
    password,
    setPassword,
    loginError,
    setLoginError,
    handleLogin,
    toast,
  } = useAppState();

  if (currentUser) return <Navigate to="/dashboard" replace />;

  return (
    <LoginScreen
      username={username}
      setUsername={setUsername}
      password={password}
      setPassword={setPassword}
      loginError={loginError}
      setLoginError={setLoginError}
      handleLogin={handleLogin}
      toast={toast}
    />
  );
}

function RootRedirect() {
  const { currentUser } = useAppState();
  return <Navigate to={currentUser ? "/dashboard" : "/login"} replace />;
}

function AdminOnly({ children }) {
  const { isAdmin } = useAppState();
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
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
    movementModal,
    setMovementModal,
    movementForm,
    setMovementForm,
    movementTypes,
    saveMovement,
    accountModal,
    setAccountModal,
    accountForm,
    setAccountForm,
    saveAccount,
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
      />
      <MovementModal
        movementModal={movementModal}
        setMovementModal={setMovementModal}
        movementForm={movementForm}
        setMovementForm={setMovementForm}
        movementTypes={movementTypes}
        isAdmin={isAdmin}
        saveMovement={saveMovement}
      />
      <AccountModal
        accountModal={accountModal}
        setAccountModal={setAccountModal}
        accountForm={accountForm}
        setAccountForm={setAccountForm}
        saveAccount={saveAccount}
      />
      <Toast toast={toast} />
    </div>
  );
}

function ProtectedLayout() {
  const { currentUser } = useAppState();
  if (!currentUser) return <Navigate to="/login" replace />;
  return <AppShell />;
}

function DashboardRoute() {
  const {
    isAdmin,
    displayName,
    openAddProduct,
    items,
    totalUnits,
    lowStockItems,
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
      totalUnits={totalUnits}
      lowStockItems={lowStockItems}
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
    totalUnits,
    lowStockItems,
    inventoryValue,
    filteredItems,
    search,
    setSearch,
    filter,
    setFilter,
    openMovement,
    openEditProduct,
    deleteProduct,
  } = useAppState();

  return (
    <InventoryPage
      isAdmin={isAdmin}
      openAddProduct={openAddProduct}
      items={items}
      totalUnits={totalUnits}
      lowStockItems={lowStockItems}
      inventoryValue={inventoryValue}
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
    />
  );
}

function ActivityRoute() {
  const { movements, items, users } = useAppState();

  return (
    <ActivityPage
      movements={movements}
      items={items}
      users={users}
      movementDelta={movementDelta}
      movementLabel={movementLabel}
    />
  );
}

function TeamRoute() {
  const { openAddAccount, users, currentUser, removeAccount } = useAppState();

  return (
    <TeamPage
      openAddAccount={openAddAccount}
      users={users}
      roleLabel={roleLabel}
      currentUser={currentUser}
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
        <AppRoutes />
      </AppStateProvider>
    </BrowserRouter>
  );
}
