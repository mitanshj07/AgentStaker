export type AiPrediction = {
  probabilityYes: number
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  reasoning: string
  keyFactors: string[]
  riskWarnings: string[]
  suggestedPosition: string
  dataSourcesUsed: string[]
}

export type AiAdapterConfig = {
  provider: 'GEMINI' | 'OPENAI' | 'NONE'
  model: string
  apiKey: string
}

function getEnv(key: string): string | undefined {
  return process.env[key]
}

export function getAiConfig(): AiAdapterConfig {
  const geminiKey = getEnv('GOOGLE_AI_API_KEY')
  if (geminiKey) {
    return { provider: 'GEMINI', model: 'gemini-2.0-flash', apiKey: geminiKey }
  }
  
  const openAiKey = getEnv('OPENAI_API_KEY')
  if (openAiKey) {
    return { provider: 'OPENAI', model: getEnv('OPENAI_MODEL') || 'gpt-4-turbo-preview', apiKey: openAiKey }
  }
  
  return { provider: 'NONE', model: '', apiKey: '' }
}

export async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const config = getAiConfig()
  
  if (config.provider === 'NONE') {
    throw new Error('No AI adapter configured')
  }

  if (config.provider === 'GEMINI') {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.7,
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${await response.text()}`)
    }

    const data = await response.json() as any
    return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  }

  if (config.provider === 'OPENAI') {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${await response.text()}`)
    }

    const data = await response.json() as any
    return data.choices?.[0]?.message?.content || ''
  }

  throw new Error('Unsupported provider')
}

export async function getStructuredPrediction(systemPrompt: string, marketContext: string): Promise<AiPrediction> {
  const config = getAiConfig()
  if (config.provider === 'NONE') {
    return getDeterministicFallback()
  }

  const formatPrompt = `
You must respond ONLY with a valid JSON object matching this schema. Do not include markdown code blocks or any other text.
{
  "probabilityYes": 0.0 to 1.0 (number),
  "confidence": "LOW" | "MEDIUM" | "HIGH",
  "reasoning": "Detailed explanation of your prediction (string)",
  "keyFactors": ["factor 1", "factor 2"] (array of strings),
  "riskWarnings": ["risk 1", "risk 2"] (array of strings),
  "suggestedPosition": "e.g., YES at 0.62" (string),
  "dataSourcesUsed": ["source 1"] (array of strings)
}

Market Context:
${marketContext}
`

  try {
    const result = await callAI(systemPrompt, formatPrompt)
    let jsonStr = result.trim()
    if (jsonStr.startsWith('\`\`\`json')) jsonStr = jsonStr.substring(7)
    if (jsonStr.startsWith('\`\`\`')) jsonStr = jsonStr.substring(3)
    if (jsonStr.endsWith('\`\`\`')) jsonStr = jsonStr.substring(0, jsonStr.length - 3)
    
    return JSON.parse(jsonStr.trim()) as AiPrediction
  } catch (error) {
    console.error('AI Prediction error:', error)
    return getDeterministicFallback()
  }
}

function getDeterministicFallback(): AiPrediction {
  return {
    probabilityYes: 0.57,
    confidence: 'MEDIUM',
    reasoning: 'The market and agent estimate are close; size conservatively. (Deterministic fallback)',
    keyFactors: ['Market volatility', 'Historical averages'],
    riskWarnings: ['Oracle source quality', 'Late market-moving information'],
    suggestedPosition: 'YES at current odds',
    dataSourcesUsed: ['Deterministic Fallback Model']
  }
}

export async function getCustomStructuredPrediction<T>(systemPrompt: string, userPrompt: string, formatPrompt: string, fallback: T): Promise<T> {
  const config = getAiConfig()
  if (config.provider === 'NONE') {
    return fallback
  }

  const fullPrompt = `
${userPrompt}

You must respond ONLY with a valid JSON object matching this schema. Do not include markdown code blocks or any other text.
${formatPrompt}
`

  try {
    const result = await callAI(systemPrompt, fullPrompt)
    let jsonStr = result.trim()
    if (jsonStr.startsWith('```json')) jsonStr = jsonStr.substring(7)
    if (jsonStr.startsWith('```')) jsonStr = jsonStr.substring(3)
    if (jsonStr.endsWith('```')) jsonStr = jsonStr.substring(0, jsonStr.length - 3)
    
    return JSON.parse(jsonStr.trim()) as T
  } catch (error) {
    console.error('Custom AI Prediction error:', error)
    return fallback
  }
}
