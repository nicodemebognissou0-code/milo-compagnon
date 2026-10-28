// netlify/functions/chat.js
// MILO : fonction serveur qui relaie les messages vers Gemini.

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });

// Nettoie un texte court (prénom, humeur) : pas de retours à la ligne, longueur limitée.
const clean = (value, max) =>
  String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim()
    .slice(0, max);

const MAX_MESSAGE = 2000;
const MAX_HISTORY = 20;

const ASSISTANT_ROLES = ["assistant", "model", "milo", "bot", "ai"];

// Transforme l'historique envoyé par le site en format Gemini.
function buildContents(history, message) {
  const turns = [];

  const push = (role, text) => {
    const last = turns[turns.length - 1];
    if (last && last.role === role) {
      last.parts[0].text += "\n" + text;
    } else {
      turns.push({ role, parts: [{ text }] });
    }
  };

  if (Array.isArray(history)) {
    for (const item of history.slice(-MAX_HISTORY)) {
      if (!item || typeof item !== "object") continue;
      const text = String(item.text ?? item.content ?? item.message ?? "")
        .trim()
        .slice(0, MAX_MESSAGE);
      if (!text) continue;
      const roleRaw = String(item.role ?? item.sender ?? "").toLowerCase();
      push(ASSISTANT_ROLES.includes(roleRaw) ? "model" : "user", text);
    }
  }

  // Si le site a déjà inclus le message courant dans l'historique, on l'enlève.
  const last = turns[turns.length - 1];
  if (last && last.role === "user" && last.parts[0].text.trim() === message) {
    turns.pop();
  }

  // Gemini attend que la conversation commence par l'utilisateur.
  while (turns.length && turns[0].role === "model") turns.shift();

  push("user", message);
  return turns;
}

// Appelle Gemini avec délai maximal et nouvelles tentatives en cas de surcharge.
async function callGemini(apiKey, model, payload) {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(model) +
    ":generateContent";

  const deadline = Date.now() + 8500; // Netlify coupe les fonctions vers 10 s
  const retryable = [429, 500, 503, 504];
  let lastError = { ok: false, status: 504, message: "Délai dépassé" };

  for (let attempt = 0; attempt < 3; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining < 1500) break;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(remaining, 6500));

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) return { ok: true, data };

      lastError = {
        ok: false,
        status: res.status,
        message: data?.error?.message || "Erreur inconnue de Gemini"
      };
      if (!retryable.includes(res.status)) return lastError;
    } catch (err) {
      lastError = {
        ok: false,
        status: err?.name === "AbortError" ? 504 : 502,
        message: err?.message || "Erreur réseau"
      };
    } finally {
      clearTimeout(timer);
    }

    await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
  }

  return lastError;
}

// Message clair pour l'utilisateur selon le code d'erreur Gemini.
function friendlyError(status) {
  if (status === 429) {
    return { http: 429, text: "Trop de messages d'un coup. Réessaie dans quelques instants." };
  }
  if (status === 503 || status === 500 || status === 504) {
    return { http: 503, text: "MILO est très sollicité en ce moment. Réessaie dans un instant." };
  }
  if (status === 404) {
    return { http: 502, text: "MILO n'arrive pas à joindre son modèle d'IA. Le modèle doit être mis à jour." };
  }
  if (status === 400 || status === 401 || status === 403) {
    return { http: 502, text: "Problème de configuration de MILO (clé ou autorisations). Réessaie plus tard." };
  }
  return { http: 502, text: "Une erreur est survenue. Réessaie dans un instant." };
}

const SYSTEM_PROMPT =
  "Tu es MILO, un compagnon du quotidien francophone. " +
  "Tu es naturel, chaleureux, complice sans être excessif. " +
  "Tu écoutes avant de conseiller. Tu réponds de façon concise, en général 2 à 4 phrases, " +
  "sans moraliser ni répéter de phrases toutes faites. " +
  "Tu poses au maximum une question à la fois. " +
  "Tu réponds en français, sauf si la personne écrit dans une autre langue. " +
  "Tu es une IA, pas un humain ni un thérapeute. " +
  "Tu n'encourages pas une dépendance affective exclusive : tu valorises aussi les proches et les activités de la personne. " +
  "Si la personne exprime une détresse grave ou des idées de se faire du mal, tu réponds avec douceur, " +
  "tu l'encourages à en parler à une personne de confiance ou aux services d'urgence de son pays, " +
  "et tu restes présent dans la conversation.";

export default async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Méthode non autorisée" }, 405);
  }

  try {
    const apiKey = Netlify.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      console.error("GEMINI_API_KEY manquante dans Netlify");
      return json({ error: "MILO n'est pas configuré correctement." }, 500);
    }

    // Modèle modifiable depuis Netlify (variable GEMINI_MODEL) sans toucher au code.
    const model = Netlify.env.get("GEMINI_MODEL") || "gemini-flash-latest";
    const debug = Netlify.env.get("MILO_DEBUG") === "true";

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Requête invalide." }, 400);
    }

    const message = String(body?.message ?? "").trim().slice(0, MAX_MESSAGE);
    if (!message) {
      return json({ error: "Message vide." }, 400);
    }

    const mood = clean(body?.mood, 40) || "non précisée";
    const name = clean(body?.name, 40);
    const history = body?.history ?? body?.messages;

    const systemText =
      SYSTEM_PROMPT +
      " Humeur indiquée par la personne : " + mood + "." +
      (name ? " Elle s'appelle " + name + "." : "");

    const payload = {
      systemInstruction: { parts: [{ text: systemText }] },
      contents: buildContents(history, message),
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 1024
      }
    };

    const result = await callGemini(apiKey, model, payload);

    if (!result.ok) {
      console.error("Erreur Gemini", result.status, result.message);
      const { http, text } = friendlyError(result.status);
      const out = { error: text };
      if (debug) out.debug = "Gemini " + result.status + " : " + result.message;
      return json(out, http);
    }

    const data = result.data;
    const candidate = data?.candidates?.[0];

    const reply = (candidate?.content?.parts || [])
      .filter((part) => !part.thought)
      .map((part) => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      const blocked =
        data?.promptFeedback?.blockReason ||
        candidate?.finishReason === "SAFETY" ||
        candidate?.finishReason === "PROHIBITED_CONTENT";
      return json({
        reply: blocked
          ? "Je ne peux pas répondre à ça, mais je suis là si tu veux en parler autrement."
          : "Je suis là. Tu peux me redire ça ?"
      });
    }

    return json({ reply });
  } catch (error) {
    console.error("Erreur inattendue", error);
    return json({ error: "Une erreur est survenue. Réessaie dans un instant." }, 500);
  }
};
