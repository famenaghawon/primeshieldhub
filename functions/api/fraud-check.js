// /functions/api/fraud-check.js

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();

    let riskScore = 0;

    if (!body.fingerprint) riskScore += 40;
    if (body.amount > 500000) riskScore += 30;

    const allowed = riskScore < 70;

    return new Response(JSON.stringify({
      allowed,
      riskScore
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({
      allowed: true,
      riskScore: 0
    }));
  }
}
