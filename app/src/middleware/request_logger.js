import logger from "../core/logger/logger.js";
import crypto from "crypto";

export function request_logger(req, res, next) {
  const request_id = crypto.randomUUID();
  req.request_id = request_id;

  logger.info("request_start", {
    request_id,
    method: req.method,
    path: req.originalUrl,
  });

  res.on("finish", () => {
    logger.info("request_end", {
      request_id,
      status_code: res.statusCode,
    });
  });

  next();
}
