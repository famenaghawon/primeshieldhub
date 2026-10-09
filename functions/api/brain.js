// /functions/api/brain.js

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();

    const OPENAI_API_KEY = context.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing API key" }), { status: 500 });
    }

    const ai = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a smart ecommerce AI that predicts the next best page."
          },
          {
            role: "user",
            content: JSON.stringify(body)
          }
        ],
        temperature: 0.2
      })
    });

    const data = await ai.json();

    let text = data.choices?.[0]?.message?.content || "{}";

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { nextPage: "/" };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ nextPage: "/" }), { status: 200 });
  }
}

// 🔥 THIS FIXES 405 FOR GET REQUESTS
export async function onRequestGet() {
  return new Response(JSON.stringify({ status: "brain alive" }), {
    headers: { "Content-Type": "application/json" }
  });
}
