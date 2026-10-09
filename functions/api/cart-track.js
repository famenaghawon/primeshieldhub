export async function onRequestPost(context) {
  try {
    const cartData = await context.request.json();
    console.log("🛒 Abandoned cart:", cartData);

    // Store in KV or database (optional)
    // Example: await context.env.CARTS.put(cartData.userId, JSON.stringify(cartData));

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
