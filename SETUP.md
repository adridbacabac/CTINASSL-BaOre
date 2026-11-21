# Ba'Oré Cosmetics Inventory - Setup

This guide covers a local Windows development setup for the React frontend, Express API, and MongoDB database.

## Prerequisites

- Windows 10 or later
- Node.js 20 LTS or later, including npm
- MongoDB Community Server and MongoDB Shell (`mongosh`)
- Git, if you are cloning the repository

Download Node.js from [nodejs.org](https://nodejs.org/en/download/). Download MongoDB Community Server from the [MongoDB Community download page](https://www.mongodb.com/try/download/community). The MongoDB installer can install MongoDB as a Windows service. Install MongoDB Shell (`mongosh`) separately if it is not included in your MongoDB installation.

Open PowerShell and verify Node.js and npm are available:

```powershell
node --version
npm --version
```

## Configure MongoDB as a single-node replica set

The API and seed script use MongoDB transactions, so a standalone MongoDB server is not sufficient. For local development, configure a single-node replica set named `rs0`.

1. Start MongoDB Community Server once so its Windows service and configuration file are installed. The default configuration file is usually under `C:\Program Files\MongoDB\Server\<version>\bin\mongod.cfg`; the exact version folder may differ.
2. Open PowerShell as Administrator and stop the MongoDB service:

   ```powershell
   Stop-Service MongoDB
   ```

3. Open `mongod.cfg` with Administrator permissions. Add the following top-level setting, preserving any existing settings and YAML indentation:

   ```yaml
   replication:
     replSetName: rs0
   ```

4. Start the service again:

   ```powershell
   Start-Service MongoDB
   ```

5. In a regular PowerShell window, connect with `mongosh` and initiate the replica set:

   ```powershell
   mongosh "mongodb://127.0.0.1:27017/admin"
   ```

   At the `mongosh` prompt, run:

   ```javascript
   rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "127.0.0.1:27017" }] })
   rs.status()
   ```

   Wait until the member state is `PRIMARY`. If the replica set was already initiated, do not initiate it again; check `rs.status()` and confirm the set name is `rs0`.

## Install project dependencies

From the repository root, install the frontend dependencies:

```powershell
npm ci
```

Install the backend dependencies in a second command:

```powershell
Set-Location server
npm ci
Set-Location ..
```

## Configure environment files

Create local environment files from the checked-in examples:

```powershell
Copy-Item .env.example .env
Copy-Item server\.env.example server\.env
```

Edit the root `.env` and `server\.env` files. They are local configuration files and must not be committed.

### Frontend: `.env`

The example value points the frontend to the local API:

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:5000
```

### Backend: `server\.env`

Keep the local database URI and client origin consistent with the examples:

```dotenv
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/baore_cosmetics?replicaSet=rs0
CLIENT_ORIGIN=http://127.0.0.1:5173
JWT_SECRET=replace-with-a-random-secret-of-at-least-32-characters
JWT_EXPIRES_IN=8h
SEED_ADMIN_PASSWORD=
SEED_EMPLOYEE_PASSWORD=
```

Replace `JWT_SECRET` with a private random value of at least 32 characters. For example, generate one in PowerShell with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Set `SEED_ADMIN_PASSWORD` and `SEED_EMPLOYEE_PASSWORD` to the initial passwords you want to use for the seeded administrator and employee accounts. Both are required when running the seed command. The seed script hashes them before storing them. Do not use real or shared credentials in a committed file.

The `CLIENT_ORIGIN` must exactly match the browser origin, including the host and port. With the provided values, open the site at `http://127.0.0.1:5173` (not `http://localhost:5173`), so the credentialed API requests and session cookie use the configured origin.

## Create and seed the database

Ensure the MongoDB service is running and the `rs0` member is `PRIMARY`. Then run the seed script from the backend folder:

```powershell
Set-Location server
npm run seed
```

The seed command creates the `baore_cosmetics` database on its first successful write, creates the required collection indexes, and inserts the starter products and accounts. You do not need to create the database or collections manually. It is safe to rerun when the existing starter records match; conflicting existing records cause the seed to stop rather than overwrite them.

The seeded sign-in usernames are `admin` and `employee`. Use the passwords you set in `SEED_ADMIN_PASSWORD` and `SEED_EMPLOYEE_PASSWORD`. The seed data contains eight starter products.

## Run the backend and frontend

Use two PowerShell terminals and keep both development servers running.

In the first terminal, start the API:

```powershell
Set-Location server
npm run dev
```

The API listens at `http://127.0.0.1:5000`. Check its health endpoint in a browser or another terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:5000/api/health
```

It should report `"api": "healthy"` and `"database": "connected"`.

In the second terminal, start the Vite frontend from the repository root:

```powershell
npm run dev
```

Open the URL Vite prints, normally `http://127.0.0.1:5173`.

To run the available automated tests:

```powershell
# From the repository root
npm test

# From the server folder
npm test
```

## Troubleshooting

### MongoDB connection times out or the API cannot connect

- Confirm the MongoDB Windows service is running: `Get-Service MongoDB`.
- Confirm MongoDB is listening on `127.0.0.1:27017`.
- Check that `server\.env` has the correct URI and includes both `/baore_cosmetics` and `?replicaSet=rs0`.

### Error says replica set is not configured, or transactions are unsupported

- Check `mongod.cfg` for the top-level `replication.replSetName: rs0` setting.
- Restart the MongoDB service after changing its configuration.
- In `mongosh`, run `rs.status()` and wait for the local member to become `PRIMARY`.
- Confirm the URI includes `replicaSet=rs0`.

### Seed fails because a password is missing

Set both `SEED_ADMIN_PASSWORD` and `SEED_EMPLOYEE_PASSWORD` in `server\.env`, then rerun `npm run seed` from `server`.

### Seed reports a conflict with existing users or products

The seed command deliberately does not overwrite mismatched starter records. Review the conflict message and the existing data before deciding how to resolve it. Do not drop a database containing data you need.

### Frontend cannot reach the API or sign-in/session requests fail

- Confirm both the API and frontend servers are running.
- Check root `.env` has `VITE_API_BASE_URL=http://127.0.0.1:5000`.
- Check `server\.env` has `CLIENT_ORIGIN=http://127.0.0.1:5173`.
- Use `127.0.0.1` consistently in the browser rather than switching between it and `localhost`.
- Restart the Vite server after editing the root `.env`.

### Port 5000 or 5173 is already in use

Stop the other process using the port, or change the corresponding configuration. If changing the backend port, update both `VITE_API_BASE_URL` in the root `.env` and `PORT` in `server\.env`, then restart both servers.

### `node` or `npm` is not recognized

Install Node.js, close and reopen PowerShell so the updated PATH is loaded, then verify with `node --version` and `npm --version`.
