import client from "prom-client";

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const http_request_total = new client.Counter({
  name: "http_request_total",
  help: "total http requests",
  labelNames: ["method", "path", "status"],
});

register.registerMetric(http_request_total);
