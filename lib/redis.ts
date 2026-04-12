import Redis from "ioredis";

const REDIS_URL =
  process.env.REDIS_URL ||
  "redis://default:f3BpGGaTvGFV7DqyzfGxTIQVrPvC6!H7@redis.railway.internal:6379";

// Singleton for general use (PUBLISH, GET, SET, LPUSH etc)
let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    client.connect().catch((err) => {
      console.error("[redis] Connection error:", err.message);
    });
  }
  return client;
}

/**
 * Factory for subscribers — each SSE connection needs its own Redis client
 * because a subscribed client can't be used for other commands.
 */
export function createSubscriber(): Redis {
  return new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  });
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
  try {
    const redis = getRedis();
    const event = JSON.stringify({
      stage,
      message,
      timestamp: new Date().toISOString(),
      data,
    });
    await redis.publish(`discovery:${khSetId}`, event);
  } catch (err) {
    // Don't fail the request if Redis is unavailable
    console.error("[redis] Publish error:", err);
  }
}
