export async function onRequestPost(context) {
  try {
    const { productId, userId, behavior } = await context.request.json();

    const OPENAI_API_KEY = context.env.OPENAI_API_KEY;

    const prompt = `
You are an AI recommendation engine for an e‑commerce site.

Current product ID: ${productId}
User behavior: ${JSON.stringify(behavior)}

Return 3 relevant product IDs (from our catalog) that the user is likely to buy.
The catalog includes: iphone14pm, iphone15pm, s23ultra, s24ultra, airpodspro2, macbookprom3, powerbank20k, galaxybuds2, ipadpro13, watch9.

Return JSON: { "recommendations": ["id1","id2","id3"] }
`;

    const ai = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4
      })
    });

    const data = await ai.json();
    let text = data.choices?.[0]?.message?.content || "{}";
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { recommendations: [] };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ recommendations: [] }), { status: 200 });
  }
}
