import type { ProviderType } from '@/features/providers/types'

export interface OfficialModelPreset {
  modelId: string
  displayName: string
  capabilities: string[]
  multiplier: number
}

export interface OfficialProviderPreset {
  type: ProviderType
  label: string
  baseUrl: string
  models: OfficialModelPreset[]
}

export const OFFICIAL_PRESETS: OfficialProviderPreset[] = [
  {
    type: 'openai-compatible',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      {
        modelId: 'gpt-4o',
        displayName: 'GPT-4o',
        capabilities: ['chat', 'code', 'reasoning', 'vision'],
        multiplier: 1,
      },
      {
        modelId: 'gpt-4o-mini',
        displayName: 'GPT-4o mini',
        capabilities: ['chat', 'code', 'summarization'],
        multiplier: 0.3,
      },
      {
        modelId: 'gpt-4.1',
        displayName: 'GPT-4.1',
        capabilities: ['chat', 'code', 'reasoning', 'long-context'],
        multiplier: 0.7,
      },
      {
        modelId: 'gpt-4.1-mini',
        displayName: 'GPT-4.1 mini',
        capabilities: ['chat', 'code', 'long-context'],
        multiplier: 0.2,
      },
    ],
  },
  {
    type: 'anthropic',
    label: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com',
    models: [
      {
        modelId: 'claude-sonnet-4-20250514',
        displayName: 'Claude Sonnet 4',
        capabilities: ['chat', 'code', 'reasoning', 'writing'],
        multiplier: 1,
      },
      {
        modelId: 'claude-3-5-haiku-20241022',
        displayName: 'Claude 3.5 Haiku',
        capabilities: ['chat', 'code', 'summarization'],
        multiplier: 0.25,
      },
      {
        modelId: 'claude-opus-4-20250514',
        displayName: 'Claude Opus 4',
        capabilities: ['chat', 'code', 'reasoning', 'writing', 'long-context'],
        multiplier: 3,
      },
    ],
  },
  {
    type: 'gemini',
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    models: [
      {
        modelId: 'gemini-2.0-flash',
        displayName: 'Gemini 2.0 Flash',
        capabilities: ['chat', 'code', 'vision', 'long-context'],
        multiplier: 0.3,
      },
      {
        modelId: 'gemini-1.5-pro',
        displayName: 'Gemini 1.5 Pro',
        capabilities: ['chat', 'code', 'reasoning', 'vision', 'long-context'],
        multiplier: 0.7,
      },
      {
        modelId: 'gemini-2.5-pro',
        displayName: 'Gemini 2.5 Pro',
        capabilities: ['chat', 'code', 'reasoning', 'vision', 'long-context'],
        multiplier: 1,
      },
    ],
  },
]
