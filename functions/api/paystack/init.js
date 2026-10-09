// /functions/api/paystack/init.js

export async function onRequestPost(context) {
  try {
    const { email, amount } = await context.request.json();

    const PAYSTACK_SECRET = context.env.PAYSTACK_SECRET;

    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        amount: amount * 100
      })
    });

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({
      status: false,
      message: "Payment init failed"
    }));
  }
}
