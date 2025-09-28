import axios from 'axios';

const GROQ_API_URL = process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama3-8b-8192';

export async function labelTopics(exemplars: string[]): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key || exemplars.length === 0) return 'General';

  const prompt = `You are naming a topic based on example snippets from work conversations and documents. 
Return a 3-6 word concise topic label. Examples:\n- Q3 OKR Planning\n- Kubernetes Deployment Issues\n- Customer Churn Analysis\n- Product Roadmap Discussion\n\nSnippets:\n${exemplars.map((s, i) => `${i + 1}. ${s.slice(0, 400)}`).join('\n')}\n\nLabel:`;

  try {
    const resp = await axios.post(GROQ_API_URL, {
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: 'You are a helpful assistant that creates concise topic labels.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 20,
      temperature: 0.2,
    }, {
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      }
    });

    const label = resp.data?.choices?.[0]?.message?.content?.trim() || 'General';
    return label.replace(/^\p{P}+|\p{P}+$/gu, '');
  } catch (e) {
    return 'General';
  }
}
