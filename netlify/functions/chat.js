
export default async (request) => {
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Méthode non autorisée" }),
      {
        status: 405,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      }
    );
  }

  try {
    const { message, mood, name } = await request.json();
    const apiKey = Netlify.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Clé API non configurée" }),
        { status: 500, headers: { "Content-Type": "application/json; charset=utf-8" } }
      );
    }

    const result = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: "Tu es MILO, un compagnon du quotidien francophone. Tu es naturel, chaleureux, complice sans être excessif. Tu écoutes avant de conseiller, réponds de façon concise et adaptée, sans moraliser ni répéter des phrases toutes faites. Pose au maximum une question à la fois. Tu es une IA, pas un humain ni un thérapeute. N'encourage pas une dépendance affective exclusive. Humeur de départ : " + (mood || "non précisée")
            }]
          },
          contents: [{
            role: "user",
            parts: [{ text: (name ? "Prénom : " + name + "\n" : "") + String(message || "") }]
          }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 300
          }
        })
      }
    );

    const data = await result.json();

    
if (!result.ok) {
  const detail = data.error?.message || "Erreur inconnue de Gemini";
  const status = result.status;

  return new Response(
    JSON.stringify({
      error: "Erreur Gemini (" + status + ") : " + detail
    }),
    {
      status: 502,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    }
  );
}


    const reply = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    return new Response(
      JSON.stringify({ reply: reply || "Je suis là. Tu peux me redire ça ?" }),
      { status: 200, headers: { "Content-Type": "application/json; charset=utf-8" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Une erreur est survenue. Réessaie dans un instant." }),
      { status: 500, headers: { "Content-Type": "application/json; charset=utf-8" } }
    );
  }
};
