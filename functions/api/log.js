// /functions/api/log.js

export async function onRequestPost(context) {
  try {
    const logs = await context.request.json();

    console.log("📊 Logs received:", logs);

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Log failed" }), {
      status: 500
    });
  }
}

// 🔥 CRITICAL → prevents 405
export async function onRequestGet() {
  return new Response("Logging endpoint ready");
}
