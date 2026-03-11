export default async function handler(req, res) {
      if (req.method !== 'POST') {
              return res.status(405).json({ error: 'Method not allowed' });
      }

  const { apiKey, messages, model, provider } = req.body;

  if (!apiKey) {
          return res.status(400).json({ error: 'API key is required' });
  }

  const detectedProvider = provider || detectProvider(model);

  try {
          let response;

        if (detectedProvider === 'anthropic') {
                  response = await fetch('https://api.anthropic.com/v1/messages', {
                              method: 'POST',
                              headers: {
                                            'Content-Type': 'application/json',
                                            'x-api-key': apiKey,
                                            'anthropic-version': '2023-06-01',
                              },
                              body: JSON.stringify({
                                            model: model || 'claude-3-5-haiku-20241022',
                                            max_tokens: 2000,
                                            messages: messages.filter(m => m.role !== 'system'),
                                            system: messages.find(m => m.role === 'system')?.content || '',
                              }),
                  });
                  const data = await response.json();
                  if (!response.ok) return res.status(response.status).json(data);
                  return res.status(200).json({
                              choices: [{
                                            message: {
                                                            role: 'assistant',
                                                            content: data.content?.[0]?.text || '',
                                            }
                              }]
                  });

        } else if (detectedProvider === 'gemini') {
                  const geminiModel = model || 'gemini-1.5-flash';
                  const systemMsg = messages.find(m => m.role === 'system')?.content || '';
                  const userMessages = messages.filter(m => m.role !== 'system');
                  const geminiContents = userMessages.map(m => ({
                              role: m.role === 'assistant' ? 'model' : 'user',
                              parts: [{ text: m.content }],
                  }));
                  response = await fetch(
                              `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
                      {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                                    systemInstruction: systemMsg ? { parts: [{ text: systemMsg }] } : undefined,
                                                    contents: geminiContents,
                                                    generationConfig: { temperature: 0.9, maxOutputTokens: 2000 },
                                    }),
                      }
                            );
                  const data = await response.json();
                  if (!response.ok) return res.status(response.status).json(data);
                  return res.status(200).json({
                              choices: [{
                                            message: {
                                                            role: 'assistant',
                                                            content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
                                            }
                              }]
                  });

        } else {
                  // Default: OpenAI (and OpenAI-compatible APIs)
            response = await fetch('https://api.openai.com/v1/chat/completions', {
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
                  if (!response.ok) return res.status(response.status).json(data);
                  return res.status(200).json(data);
        }

  } catch (error) {
          return res.status(500).json({ error: 'Failed to connect to AI provider', details: error.message });
  }
}

function detectProvider(model) {
      if (!model) return 'openai';
      if (model.startsWith('claude')) return 'anthr
