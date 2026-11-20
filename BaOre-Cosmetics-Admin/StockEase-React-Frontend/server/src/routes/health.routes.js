import { Router } from "express";
import { isDatabaseConnected } from "../config/database.js";

const router = Router();

router.get("/", (req, res) => {
  const connected = isDatabaseConnected();
  res.status(connected ? 200 : 503).json({
    api: connected ? "healthy" : "unavailable",
    database: connected ? "connected" : "disconnected",
    environment: req.app.locals.environment,
  });
});

export default router;
