import express from "express";
import health_controller from "../modules/health/health.controller.js";
import { register, http_request_total } from "../core/metrics/metrics.js";

const router = express.Router();

/**
 * 🔴 요청 메트릭 (가장 먼저)
 */
router.use((req, res, next) => {
  res.on("finish", () => {
    // /metrics 자체는 제외 (무한 증가 방지)
    if (req.path === "/metrics") return;

    http_request_total.inc({
      method: req.method,
      path: req.path,
      status: res.statusCode,
    });
  });
  next();
});

/**
 * Health check
 */
router.get("/health", health_controller);

/**
 * Prometheus metrics endpoint
 */
router.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

export default router;
