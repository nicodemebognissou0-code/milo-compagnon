export default async (request) => {
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Méthode non autorisée" }),
      {
        status: 405,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  return new Response(
    JSON.stringify({
      reply: "Je t'écoute. Dis-moi ce que tu as en tête."
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }
  );
};
