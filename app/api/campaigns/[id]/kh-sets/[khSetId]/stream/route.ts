import { createSubscriber } from "@/lib/redis";

/**
 * SSE endpoint for real-time discovery events.
 *
 * Subscribes to Redis channel `discovery:{khSetId}` and streams events
 * to the browser via Server-Sent Events.
 *
 * Cross-talk prevention: channel is scoped by khSetId from the URL.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ khSetId: string }> }
) {
  const { khSetId } = await params;
  const channel = `discovery:${khSetId}`;

  const encoder = new TextEncoder();
  let subscriberClosed = false;

  const stream = new ReadableStream({
    async start(controller) {
      let subscriber: ReturnType<typeof createSubscriber> | null = null;

      try {
        subscriber = createSubscriber();

        if (!subscriber) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                stage: "degraded",
                message: "Live feed unavailable (REDIS_URL not configured)",
                timestamp: new Date().toISOString(),
              })}\n\n`
            )
          );
          controller.close();
          return;
        }

        subscriber.subscribe(channel, (err) => {
          if (err) {
            console.error(`[sse] Subscribe error for ${channel}:`, err);
            controller.close();
          }
        });

        subscriber.on("message", (_ch: string, message: string) => {
          try {
            controller.enqueue(encoder.encode(`data: ${message}\n\n`));
          } catch {
            // Stream closed by client
          }
        });

        subscriber.on("error", (err) => {
          console.error(`[sse] Redis error for ${channel}:`, err.message);
        });

        // Send initial connection event
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              stage: "connected",
              message: "Live feed connected",
              timestamp: new Date().toISOString(),
            })}\n\n`
          )
        );

        // Heartbeat every 15s to keep connection alive
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: heartbeat\n\n`));
          } catch {
            clearInterval(heartbeat);
          }
        }, 15000);

        // Cleanup when stream is cancelled (client disconnects)
        const cleanup = () => {
          if (subscriberClosed) return;
          subscriberClosed = true;
          clearInterval(heartbeat);
          if (subscriber) {
            subscriber.unsubscribe(channel).catch(() => {});
            subscriber.quit().catch(() => {});
          }
        };

        // Listen for abort signal (client disconnect)
        _req.signal.addEventListener("abort", cleanup);
      } catch (err) {
        console.error(`[sse] Setup error for ${channel}:`, err);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
