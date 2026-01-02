import { createClient } from "redis";
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

function build_url(prefix) {
  const url = get_env(`${prefix}_URL`, undefined) ?? get_env("REDIS_URL", undefined);
  if (url) return url;

  const host =
    get_env(`${prefix}_HOST`, undefined) ?? get_env("REDIS_HOST", "127.0.0.1");
  const port = to_int(
    get_env(`${prefix}_PORT`, undefined) ?? get_env("REDIS_PORT", 6379),
    6379
  );
  const db = to_int(
    get_env(`${prefix}_DB`, undefined) ?? get_env("REDIS_DB", 0),
    0
  );
  const password =
    get_env(`${prefix}_PASSWORD`, undefined) ??
    get_env("REDIS_PASSWORD", "");

  const auth = password ? `:${encodeURIComponent(password)}@` : "";
  return `redis://${auth}${host}:${port}/${db}`;
}

function get_prefix(role) {
  if (role === "push") return "REDIS_PUSH";
  if (role === "polling") return "REDIS_POLLING";
  return "REDIS";
}

function create_redis_client(role) {
  const prefix = get_prefix(role);
  const client = createClient({
    url: build_url(prefix),
  });

  client.on("error", (err) => {
    logger.error("redis_error", { message: err?.message ?? String(err) });
  });

  return client;
}

const redis_clients = new Map();

function get_client_key(role, kind) {
  return `${role || "default"}:${kind || "general"}`;
}

export function get_redis_client(role = "polling", kind = "general") {
  const key = get_client_key(role, kind);
  if (!redis_clients.has(key)) {
    redis_clients.set(key, create_redis_client(role));
  }
  return redis_clients.get(key);
}

export async function connect_redis(role = "polling", kind = "general") {
  const client = get_redis_client(role, kind);
  if (!client.isOpen) {
    await client.connect();
  }
  return client;
}

export async function disconnect_redis(role = "polling", kind = "general") {
  const key = get_client_key(role, kind);
  const client = redis_clients.get(key);
  if (!client) return;
  if (client.isOpen) {
    await client.quit();
  }
  redis_clients.delete(key);
}

export async function disconnect_all_redis() {
  const closers = [];
  for (const client of redis_clients.values()) {
    if (client.isOpen) {
      closers.push(client.quit());
    }
  }
  redis_clients.clear();
  await Promise.allSettled(closers);
}

export async function redis_get(key, role = "polling") {
  const client = await connect_redis(role);
  const value = await client.get(key);
  if (value === null) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export async function redis_set(key, value, ttl_seconds = 60, role = "push") {
  const client = await connect_redis(role);
  const payload =
    typeof value === "string" ? value : JSON.stringify(value);
  if (ttl_seconds === undefined || ttl_seconds === null) {
    return client.set(key, payload);
  }
  if (ttl_seconds <= 0) {
    return client.set(key, payload);
  }
  return client.setEx(key, ttl_seconds, payload);
}

export async function redis_del(key, role = "push") {
  const client = await connect_redis(role);
  return client.del(key);
}

export async function redis_publish(channel, message, role = "push") {
  const client = await connect_redis(role, "pub");
  return client.publish(channel, message);
}

export async function redis_subscribe(channel, handler, role = "polling") {
  const client = await connect_redis(role, "sub");
  await client.subscribe(channel, (message) => handler(message, channel));
  return () => client.unsubscribe(channel);
}

export async function redis_stream_add(
  stream,
  fields,
  id = "*",
  options,
  role = "push"
) {
  const client = await connect_redis(role);
  if (options) {
    return client.xAdd(stream, id, fields, options);
  }
  return client.xAdd(stream, id, fields);
}

export async function redis_stream_group_create(
  stream,
  group,
  id = "$",
  role = "polling"
) {
  const client = await connect_redis(role);
  return client.xGroupCreate(stream, group, id, { MKSTREAM: true });
}

export async function redis_stream_group_read(
  stream,
  group,
  consumer,
  id = ">",
  options = { COUNT: 10, BLOCK: 5000 },
  role = "polling"
) {
  const client = await connect_redis(role);
  return client.xReadGroup(group, consumer, { key: stream, id }, options);
}

export async function redis_stream_ack(
  stream,
  group,
  id,
  role = "polling"
) {
  const client = await connect_redis(role);
  return client.xAck(stream, group, id);
}

export async function redis_hash_set(key, fields, role = "push") {
  const client = await connect_redis(role);
  return client.hSet(key, fields);
}

export async function redis_hash_get(key, field, role = "polling") {
  const client = await connect_redis(role);
  return client.hGet(key, field);
}

export async function redis_hash_get_all(key, role = "polling") {
  const client = await connect_redis(role);
  return client.hGetAll(key);
}

export async function redis_hash_del(key, field, role = "push") {
  const client = await connect_redis(role);
  return client.hDel(key, field);
}

export async function redis_set_add(key, members, role = "push") {
  const client = await connect_redis(role);
  return client.sAdd(key, members);
}

export async function redis_set_members(key, role = "polling") {
  const client = await connect_redis(role);
  return client.sMembers(key);
}

export async function redis_set_remove(key, members, role = "push") {
  const client = await connect_redis(role);
  return client.sRem(key, members);
}

export async function redis_set_is_member(key, member, role = "polling") {
  const client = await connect_redis(role);
  return client.sIsMember(key, member);
}

export { create_redis_client };
