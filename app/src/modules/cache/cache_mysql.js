import logger from "../../core/logger/logger.js";
import { mysql_query } from "../mysql/mysql.js";
import { redis_get, redis_set } from "../redis/redis.js";

export async function cached_mysql_query({
  cache_key,
  ttl_seconds = 60,
  mysql_input,
  mysql_params = [],
  mysql_role = "polling",
  redis_role = "polling",
  lazy = false,
}) {
  try {
    const cached = await redis_get(cache_key, redis_role);
    if (cached !== null) {
      logger.info("cache_hit", { cache_key });
      return cached;
    }
    logger.info("cache_miss", { cache_key });
  } catch (err) {
    logger.warn("redis_cache_read_failed", {
      message: err?.message ?? String(err),
    });
  }

  const load_and_cache = async () => {
    const data = await mysql_query(mysql_input, mysql_params, mysql_role);

    try {
      await redis_set(cache_key, data, ttl_seconds, redis_role);
    } catch (err) {
      logger.warn("redis_cache_write_failed", {
        message: err?.message ?? String(err),
      });
    }

    return data;
  };

  if (lazy) {
    logger.info("cache_lazy_load", { cache_key });
    load_and_cache().catch((err) => {
      logger.warn("mysql_lazy_load_failed", {
        message: err?.message ?? String(err),
      });
    });
    return null;
  }

  return load_and_cache();
}
