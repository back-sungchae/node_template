import mysql from "mysql2/promise";
import logger from "../../core/logger/logger.js";

function to_int(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function get_env(name, fallback) {
  const v = process.env[name];
  if (v === undefined || String(v).trim() === "") return fallback;
  return v;
}

function get_prefix(role) {
  if (role === "push") return "MYSQL_PUSH";
  if (role === "polling") return "MYSQL_POLLING";
  return "MYSQL";
}

function create_mysql_pool(role) {
  const role_prefix = get_prefix(role);
  const base_prefix = "MYSQL";

  const host =
    get_env(`${role_prefix}_HOST`, undefined) ??
    get_env(`${base_prefix}_HOST`, "127.0.0.1");
  const port = to_int(
    get_env(`${role_prefix}_PORT`, undefined) ??
      get_env(`${base_prefix}_PORT`, 3306),
    3306
  );
  const user =
    get_env(`${role_prefix}_USER`, undefined) ??
    get_env(`${base_prefix}_USER`, "root");
  const password =
    get_env(`${role_prefix}_PASSWORD`, undefined) ??
    get_env(`${base_prefix}_PASSWORD`, "");
  const database =
    get_env(`${role_prefix}_DATABASE`, undefined) ??
    get_env(`${base_prefix}_DATABASE`, "");
  const connection_limit = to_int(
    get_env(`${role_prefix}_POOL_LIMIT`, undefined) ??
      get_env(`${base_prefix}_POOL_LIMIT`, 10),
    10
  );

  return mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: connection_limit,
    queueLimit: 0,
  });
}

const mysql_pools = new Map();

function get_pool(role) {
  const key = role || "default";
  if (!mysql_pools.has(key)) {
    mysql_pools.set(key, create_mysql_pool(role));
  }
  return mysql_pools.get(key);
}

export async function close_mysql_pool(role) {
  const key = role || "default";
  const pool = mysql_pools.get(key);
  if (!pool) return;
  await pool.end();
  mysql_pools.delete(key);
}

export async function close_all_mysql_pools() {
  const closers = [];
  for (const pool of mysql_pools.values()) {
    closers.push(pool.end());
  }
  mysql_pools.clear();
  await Promise.allSettled(closers);
}

function build_join(join) {
  if (!join) return "";
  if (typeof join === "string") return ` ${join}`;

  if (Array.isArray(join)) {
    const parts = join.map((item) => {
      if (typeof item === "string") return item;
      const type = item.type ? `${item.type} ` : "";
      return `${type}JOIN ${item.table} ON ${item.on}`;
    });
    return ` ${parts.join(" ")}`;
  }

  return "";
}

function build_where(where, where_params = []) {
  if (!where) return { clause: "", params: [] };

  if (typeof where === "string") {
    return { clause: ` WHERE ${where}`, params: where_params };
  }

  if (typeof where === "object") {
    const keys = Object.keys(where);
    const clause = keys.length
      ? ` WHERE ${keys.map((key) => `${key} = ?`).join(" AND ")}`
      : "";
    const params = keys.map((key) => where[key]);
    return { clause, params };
  }

  return { clause: "", params: [] };
}

function build_select_query(options) {
  const select = options.select
    ? Array.isArray(options.select)
      ? options.select.join(", ")
      : options.select
    : "*";
  const join_clause = build_join(options.join);
  const { clause: where_clause, params: where_params } = build_where(
    options.where,
    options.where_params || []
  );
  const order_by = options.order_by ? ` ORDER BY ${options.order_by}` : "";
  const limit = Number.isFinite(options.limit) ? ` LIMIT ${options.limit}` : "";
  const offset = Number.isFinite(options.offset)
    ? ` OFFSET ${options.offset}`
    : "";

  const query = `SELECT ${select} FROM ${options.table}${join_clause}${where_clause}${order_by}${limit}${offset}`;
  return { query, params: where_params };
}

function build_insert_query(options) {
  const keys = Object.keys(options.data || {});
  const placeholders = keys.map(() => "?").join(", ");
  const columns = keys.join(", ");
  const query = `INSERT INTO ${options.table} (${columns}) VALUES (${placeholders})`;
  const params = keys.map((key) => options.data[key]);
  return { query, params };
}

function build_update_query(options) {
  const keys = Object.keys(options.data || {});
  const set_clause = keys.map((key) => `${key} = ?`).join(", ");
  const { clause: where_clause, params: where_params } = build_where(
    options.where,
    options.where_params || []
  );
  const query = `UPDATE ${options.table} SET ${set_clause}${where_clause}`;
  const params = [...keys.map((key) => options.data[key]), ...where_params];
  return { query, params };
}

function build_delete_query(options) {
  const { clause: where_clause, params: where_params } = build_where(
    options.where,
    options.where_params || []
  );
  const query = `DELETE FROM ${options.table}${where_clause}`;
  return { query, params: where_params };
}

export function normalize_mysql_query(input, params = []) {
  if (typeof input === "string") {
    return { query: input, params };
  }

  if (!input || typeof input !== "object") {
    throw new Error("Invalid mysql query input");
  }

  if (input.query) {
    return { query: input.query, params: input.params || [] };
  }

  if (!input.table) {
    throw new Error("Missing mysql table");
  }

  const type = input.type
    ? String(input.type).toLowerCase()
    : input.data
      ? input.where
        ? "update"
        : "insert"
      : input.delete
        ? "delete"
        : "select";

  if (type === "select") return build_select_query(input);
  if (type === "insert") return build_insert_query(input);
  if (type === "update") return build_update_query(input);
  if (type === "delete") return build_delete_query(input);

  throw new Error(`Unsupported mysql query type: ${type}`);
}

export async function mysql_query(input, params = [], role = "polling") {
  const { query, params: normalized_params } = normalize_mysql_query(
    input,
    params
  );
  const slow_ms = to_int(process.env.MYSQL_SLOW_MS, 300);
  const start = Date.now();

  try {
    const [rows] = await get_pool(role).execute(query, normalized_params);
    const duration_ms = Date.now() - start;
    if (duration_ms >= slow_ms) {
      logger.warn("mysql_slow_query", { duration_ms, role });
    }
    return rows;
  } catch (err) {
    const duration_ms = Date.now() - start;
    logger.error("mysql_query_failed", {
      duration_ms,
      role,
      message: err?.message ?? String(err),
    });
    throw err;
  }
}

export async function mysql_push(input, params = []) {
  return mysql_query(input, params, "push");
}

export async function mysql_poll(input, params = []) {
  return mysql_query(input, params, "polling");
}
