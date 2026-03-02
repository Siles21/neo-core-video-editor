export default async function handler(req, res) {
    if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
    }

  const { apiKey, messages, model } = req.body;

  if (!apiKey) {
        return res.status(400).json({ error: 'API key is required' });
  }

  try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                          model: model || 'gpt-4o-mini',
                          messages: messages,
                }),
        });

      const data = await response.json();

      if (!response.ok) {
              return res.status(response.status).json(data);
      }

      return res.status(200).json(data);
  } catch (error) {
        return res.status(500).json({ error: 'Failed to connect to OpenAI', details: error.message });
  }
}
