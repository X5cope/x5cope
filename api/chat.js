// ==========================================================================
// /api/chat — Vercel serverless function
// Calls Groq server-side so the API key never reaches the browser.
// Requires GROQ_API_KEY to be set in Vercel → Project Settings →
// Environment Variables (NOT in this file, NOT in any client-side file).
// ==========================================================================

const SYSTEM_PROMPT = `You are the X5cope Assistant, a helpful chat agent for X5cope, a digital
studio that builds websites, AI chatbots, apps/PWAs, email marketing setups, and Shopify stores,
plus ongoing maintenance retainers.

Packages:
- Launch: 1-page site or basic FAQ bot. "Get online fast, look legit."
- Grow: multi-page site + chatbot with lead capture. "Never miss a customer message again."
- Scale: custom app/PWA + fully configured bot. "A system, not just a site."
- Retainer: monthly maintenance, add-on to any tier. "Keep it running, keep it improving."

Exact pricing depends on project scope, a human on the team confirms the final number.

Keep answers short (2-4 sentences), friendly, and specific to X5cope's services. If someone asks
something you can't answer confidently, or wants pricing confirmed, or wants to start a project,
tell them clearly that you'll connect them with a human on the team.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY not configured on the server' });
  }

  const { message, history } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Missing "message" in request body' });
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...(Array.isArray(history) ? history.slice(-8) : []),
    { role: 'user', content: message }
  ];

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.5,
        max_tokens: 300
      })
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('Groq API error:', errText);
      return res.status(502).json({ error: 'AI service error' });
    }

    const data = await groqRes.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || "Sorry, I didn't catch that, could you rephrase?";
    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Chat handler error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}
