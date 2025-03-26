import Router from "lume/middlewares/router.ts";

/**
 * Define routes for your site here, below the defaults.
 * Or you can create and include your own file.
 */

const DEV_MODE = Deno.env.get("LUME_DRAFTS") || false;
const router = new Router();

/* Filter out XSS attempts */
function sanitizeString(str: string): string {
  if (!str) {
    return "";
  }
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// The simple datetime server
router.get("/api", ({ _request }) => {
  const ts = Date.now();
  return new Response(JSON.stringify({ time: ts }), { status: 200 });
});

// This will probably be removed soon
router.get("/api/feedback/reset", async  ({ _request }) => {
  if (! DEV_MODE) {
    return new Response(JSON.stringify(["error:", "Not in dev mode"]), { status: 500 });
  }
  const kv_url = Deno.env.get("DENO_KV_URL");
  const kv = await Deno.openKv(kv_url ? kv_url : undefined);

  const entries = kv.list({ prefix: ["anonFeedback"] });
  let count = 0;
  for await (const entry of entries) {
    await kv.delete(entry.key);
    count ++;
  }
  return new Response(JSON.stringify({ success: true, count: count }), { status: 200 });
});

// List anon feedback (basename filters URL, * for all of it)
router.get("/api/feedback", async ({ request }) => {
  if (! DEV_MODE) {
    return new Response(JSON.stringify(["error:", "Not in dev mode"]), { status: 500 });
  }
  const kv_url = Deno.env.get("DENO_KV_URL");
  const kv = await Deno.openKv(kv_url ? kv_url : undefined);
  const url = new URL(request.url);
  const basename = url.searchParams.get("basename");

  if (!basename) {
    return new Response(
      JSON.stringify({ error: "Missing 'basename' query parameter" }),
      { status: 400 },
    );
  }

  let entries;
  if (basename === "*") {
    entries = kv.list({ prefix: ["anonFeedback"] });
  } else {
    entries = kv.list({ prefix: ["anonFeedback", basename] });
  }

  // deno-lint-ignore no-explicit-any
  const feedbackList: any[] = [];
  for await (const entry of entries) {
    try {
      const feedbackData = JSON.parse(entry.value as string);
      feedbackList.push({ key: entry.key, value: feedbackData });
    } catch (error) {
      console.error("Error parsing JSON from KV:", error);
    }
  }
  return new Response(JSON.stringify(feedbackList), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

// Handle anon feedback form submissions
router.post("/api/feedback", async ({ request }) => {
  try {
    const obj = await request.json();

    if (!obj.basename || obj.basename.length === 0) {
      return new Response(JSON.stringify(["error:", "Missing basename"]), {
        status: 500,
      });
    }

    if (obj.comment && obj.comment.length > 650) {
      return new Response(
        JSON.stringify(["error:", "Comment exceeds 650 characters"]),
        {
          status: 500,
        },
      );
    }

    if (obj.vote === undefined || obj.vote > 1 || obj.vote < -1) {
      return new Response(
        JSON.stringify([
          "error:",
          "Missing vote or invalid integer (-1, 0 or 1 supported)",
        ]),
        {
          status: 500,
        },
      );
    }

    obj.comment = sanitizeString(obj.comment);

    /* Note that this doesn't try to bypass sqlite locally,
     * unlike the other handlers. Dev submissions never go live.
     */
    const kv = await Deno.openKv();
    const res = await kv.set(
      ["anonFeedback", obj.basename, crypto.randomUUID()],
      JSON.stringify(obj),
    );

    if (res.ok) {
      return new Response(JSON.stringify(obj), { status: 201 });
    } else {
      console.error("Error inserting feedback with kv.set()");
      return new Response(JSON.stringify(["error:", "kv.set() failed"]), {
        status: 500,
      });
    }
  } catch (error) {
    console.error("Error parsing JSON:", error);
    return new Response(JSON.stringify(["error:", "Invalid JSON payload"]), {
      status: 400,
    });
  }
});

export default router;
