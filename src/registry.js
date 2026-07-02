// Provider CONNECTION registry — separate from the capability/pricing catalog (hermes lesson).
// Each entry: how to REACH a provider (baseUrl + wire protocol) and which env vars hold its key.
// catalogId maps our slug -> models.dev provider id (for metadata lookup in catalog.js).
// ponytail: hand-maintained table of the common providers; add rows as needed — no plugin system.

export const PROVIDERS = {
  openai:     { baseUrl: 'https://api.openai.com/v1',                          protocol: 'openai',    envVars: ['OPENAI_API_KEY'],                catalogId: 'openai' },
  anthropic:  { baseUrl: 'https://api.anthropic.com',                          protocol: 'anthropic', envVars: ['ANTHROPIC_API_KEY'],             catalogId: 'anthropic' },
  google:     { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', protocol: 'openai', envVars: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'], catalogId: 'google' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1',                       protocol: 'openai',    envVars: ['OPENROUTER_API_KEY'],            catalogId: 'openrouter' },
  groq:       { baseUrl: 'https://api.groq.com/openai/v1',                     protocol: 'openai',    envVars: ['GROQ_API_KEY'],                  catalogId: 'groq' },
  deepseek:   { baseUrl: 'https://api.deepseek.com',                           protocol: 'openai',    envVars: ['DEEPSEEK_API_KEY'],              catalogId: 'deepseek' },
  xai:        { baseUrl: 'https://api.x.ai/v1',                                protocol: 'openai',    envVars: ['XAI_API_KEY'],                   catalogId: 'xai' },
  mistral:    { baseUrl: 'https://api.mistral.ai/v1',                          protocol: 'openai',    envVars: ['MISTRAL_API_KEY'],               catalogId: 'mistral' },
  moonshotai: { baseUrl: 'https://api.moonshot.ai/v1',                         protocol: 'openai',    envVars: ['MOONSHOT_API_KEY'],              catalogId: 'moonshotai' },
}

export const hostOf = (u) => new URL(u).host
