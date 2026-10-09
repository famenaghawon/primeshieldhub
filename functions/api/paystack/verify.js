export async function onRequestPost(context) {
  try {
    const { reference } = await context.request.json();

    const PAYSTACK_SECRET = context.env.PAYSTACK_SECRET_KEY;

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          "Authorization": `Bearer ${PAYSTACK_SECRET}`
        }
      }
    );

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message
    }), { status: 500 });
  }
}
