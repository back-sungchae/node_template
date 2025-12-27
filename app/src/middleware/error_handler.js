import logger from "../core/logger/logger.js";

export function error_handler(err, req, res, next) {
  logger.error("unhandled_error", {
    request_id: req.request_id,
    message: err.message,
    stack: err.stack,
  });

  res.status(500).json({ message: "Internal Server Error" });
}
