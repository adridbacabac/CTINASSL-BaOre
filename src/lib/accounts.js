const USERNAME = /^[a-z0-9._-]{3,40}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Stock movements recorded before backend sign-in stored these browser-only ids.
// Used only to show who recorded those movements, never for access decisions.
const LEGACY_MOVEMENT_USERNAMES = { "admin-1": "admin", "user-1": "employee" };

export function accountFormFor(account) {
  return {
    name: account.name,
    email: account.email,
    username: account.username,
    password: "",
    role: account.role === "admin" ? "admin" : "user",
  };
}

function passwordProblem(password) {
  if (typeof password !== "string" || password.length < 8) return "Password must be at least 8 characters.";
  if (new TextEncoder().encode(password).length > 72) return "Password must be 72 bytes or fewer.";
  return "";
}

export function validateAccountForm(form, mode) {
  if (mode === "password") return passwordProblem(form.password);
  const name = form.name.trim();
  const username = form.username.trim().toLowerCase();
  const email = form.email.trim().toLowerCase();
  if (!name) return "Name is required.";
  if (name.length > 100) return "Name must be 100 characters or fewer.";
  if (!EMAIL.test(email) || email.length > 254) return "Enter a valid email address.";
  if (!USERNAME.test(username)) {
    return "Username must be 3 to 40 characters: letters, numbers, dots, dashes, or underscores.";
  }
  if (mode === "create") return passwordProblem(form.password);
  return "";
}

export function createPayload(form) {
  return {
    name: form.name.trim(),
    username: form.username.trim(),
    email: form.email.trim(),
    password: form.password,
    role: form.role === "admin" ? "admin" : "user",
  };
}

export function updatePayload(form, account) {
  const changes = {};
  const name = form.name.trim();
  const username = form.username.trim().toLowerCase();
  const email = form.email.trim().toLowerCase();
  const role = form.role === "admin" ? "admin" : "user";
  if (name !== account.name) changes.name = name;
  if (username !== account.username) changes.username = username;
  if (email !== account.email) changes.email = email;
  if (role !== account.role) changes.role = role;
  return Object.keys(changes).length ? changes : null;
}

export function adminCount(accounts) {
  return accounts.filter((account) => account.role === "admin").length;
}

export function isLastAdmin(account, accounts) {
  return account.role === "admin" && adminCount(accounts) <= 1;
}

export function isSelf(account, currentUser) {
  return Boolean(account && currentUser && account.id === currentUser.id);
}

export function deleteBlockReason(account, accounts, currentUser) {
  if (isSelf(account, currentUser)) return "You cannot delete your own account.";
  if (isLastAdmin(account, accounts)) return "Keep at least one administrator account.";
  return "";
}

export function roleLockReason(account, accounts, currentUser) {
  if (isSelf(account, currentUser)) return "You cannot remove your own administrator access.";
  if (isLastAdmin(account, accounts)) return "Keep at least one administrator account.";
  return "";
}

export function upsertAccount(accounts, account) {
  const index = accounts.findIndex((existing) => existing.id === account.id);
  if (index === -1) return [...accounts, account];
  return accounts.map((existing) => (existing.id === account.id ? account : existing));
}

export function removeAccountFrom(accounts, id) {
  return accounts.filter((account) => account.id !== id);
}

export function movementBelongsTo(movement, user) {
  if (!user) return false;
  if (movement.userId === user.id) return true;
  return LEGACY_MOVEMENT_USERNAMES[movement.userId] === user.username;
}

export function visibleMovements(movements, user, role) {
  if (role === "admin") return movements;
  return movements.filter((movement) => movementBelongsTo(movement, user));
}

export function movementStaff(movement, accounts, currentUser) {
  const people = currentUser ? [...accounts, currentUser] : accounts;
  return people.find((person) => movementBelongsTo(movement, person)) ?? null;
}
