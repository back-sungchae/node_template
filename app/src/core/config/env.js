function to_int(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function to_bool(value, fallback = false) {
  if (value === undefined) return fallback;
  const v = String(value).trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "y" || v === "on";
}

function require_env(name) {
  const v = process.env[name];
  if (v === undefined || String(v).trim() === "") {
    throw new Error(`Missing required env: ${name}`);
  }
  return String(v);
}

export function load_env() {
  const node_env = process.env.NODE_ENV || "development";

  const env = {
    node_env,
    is_production: node_env === "production",

    // 서버
    port: to_int(process.env.PORT, 3000),
    log_level:
      process.env.LOG_LEVEL || (node_env === "production" ? "info" : "debug"),

    // 관측(선택)
    enable_metrics: to_bool(process.env.ENABLE_METRICS, true),
    metrics_path: process.env.METRICS_PATH || "/metrics",

    // 보안/운영(선택)
    trust_proxy: to_bool(process.env.TRUST_PROXY, false),

    // 예: 나중에 DB 붙일 때
    // db_host: require_env('DB_HOST'),
  };

  // 간단 검증 (원하면 더 늘릴 수 있음)
  if (env.port <= 0 || env.port > 65535) {
    throw new Error(`Invalid PORT: ${env.port}`);
  }

  return Object.freeze(env);
}
