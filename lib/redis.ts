import Redis from "ioredis";

// REDIS_URL is optional. When unset, publish/subscribe become no-ops so the
// pipeline keeps working without Redis-backed SSE. Previously there was a
// hardcoded fallback URL with embedded credentials — removed for safety.
const REDIS_URL = process.env.REDIS_URL;

let client: Redis | null = null;
let clientInitFailed = false;

export function getRedis(): Redis | null {
  if (!REDIS_URL || clientInitFailed) return null;
  if (!client) {
    client = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    client.connect().catch((err) => {
      clientInitFailed = true;
      console.error("[redis] Connection error:", err.message);
    });
  }
  return client;
}

/**
 * Factory for subscribers — each SSE connection needs its own Redis client
 * because a subscribed client can't be used for other commands. Returns null
 * when REDIS_URL is not configured; callers must handle SSE degradation.
 */
export function createSubscriber(): Redis | null {
  if (!REDIS_URL) return null;
  return new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  });
}

export function isRedisConfigured(): boolean {
  return !!REDIS_URL;
}

/**
 * Publish a discovery event scoped to a specific KH set.
 * Channel: `discovery:{khSetId}`
 *
 * Events are JSON: { stage, message, timestamp, data? }
 */
export async function publishDiscoveryEvent(
  khSetId: string,
  stage: string,
  message: string,
  data?: Record<string, unknown>
) {
  const redis = getRedis();
  if (!redis) return;
  try {
    const event = JSON.stringify({
      stage,
      message,
      timestamp: new Date().toISOString(),
      data,
    });
    await redis.publish(`discovery:${khSetId}`, event);
  } catch (err) {
    console.error("[redis] Publish error:", err);
  }
}
