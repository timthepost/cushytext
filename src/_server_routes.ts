import Router from "lume/middlewares/router.ts";

/*
 * We still have to filter out XSS attempts because submitted stuff 
 * could be read in clients that are vulnerable to them.
 */
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

const router = new Router();

// The datetime server
router.get("/api", ({ _request }) => {
  const ts = Date.now();
  return new Response(JSON.stringify({ time: ts }), { status: 200 });
});

router.get("/api/feedback", async ({ _request }) => {
  const kv = await Deno.openKv();
  const entries = kv.list({ prefix: ["anonFeedback"] });
  return new Response(JSON.stringify(entries), { status: 200 });
});

// Handle anon content feedback form
router.post("/api/feedback", async ({ request }) => {
  try {
    const obj = await request.json();

    if (!obj.basename || obj.basename.length === 0) {
      return new Response(JSON.stringify(["error:", "Missing basename"]), {
        status: 500,
      });
    }

    if (obj.message && obj.message.length > 650) {
      return new Response(
        JSON.stringify(["error:", "Message exceeds 650 characters"]),
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

    obj.message = sanitizeString(obj.message);

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
