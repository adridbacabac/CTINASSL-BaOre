import { isDatabaseConnected } from "../config/database.js";

export const healthController = {
  check(req, res) {
    const connected = isDatabaseConnected();
    res.status(connected ? 200 : 503).json({
      api: connected ? "healthy" : "unavailable",
      database: connected ? "connected" : "disconnected",
      environment: req.app.locals.environment,
    });
  },
};
