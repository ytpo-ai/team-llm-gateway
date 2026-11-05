import { ProviderType } from '../providers/schemas/provider.schema.js';

export interface OfficialModelPreset {
  modelId: string;
  displayName: string;
  capabilities: string[];
  multiplier: number;
}

export interface OfficialFormatPreset {
  type: ProviderType;
  baseUrl: string;
}

export interface OfficialProviderPreset {
  key: string;
  label: string;
  formats: OfficialFormatPreset[];
  models: OfficialModelPreset[];
}

export const OFFICIAL_PRESETS: OfficialProviderPreset[] = [
  {
    key: 'openai',
    label: 'OpenAI',
    formats: [
      { type: ProviderType.OPENAI_COMPATIBLE, baseUrl: 'https://api.openai.com/v1' },
    ],
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
    key: 'anthropic',
    label: 'Anthropic Claude',
    formats: [
      { type: ProviderType.ANTHROPIC, baseUrl: 'https://api.anthropic.com' },
      { type: ProviderType.OPENAI_COMPATIBLE, baseUrl: 'https://api.anthropic.com/v1' },
    ],
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
    key: 'gemini',
    label: 'Google Gemini',
    formats: [
      { type: ProviderType.GEMINI, baseUrl: 'https://generativelanguage.googleapis.com' },
      { type: ProviderType.OPENAI_COMPATIBLE, baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' },
    ],
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
  {
    key: 'deepseek',
    label: 'DeepSeek',
    formats: [
      { type: ProviderType.OPENAI_COMPATIBLE, baseUrl: 'https://api.deepseek.com' },
      { type: ProviderType.ANTHROPIC, baseUrl: 'https://api.deepseek.com/anthropic' },
    ],
    models: [
      {
        modelId: 'deepseek-flash',
        displayName: 'DeepSeek Flash',
        capabilities: ['chat', 'code', 'long-context'],
        multiplier: 0.1,
      },
      {
        modelId: 'deepseek-v4-pro',
        displayName: 'DeepSeek V4 Pro',
        capabilities: ['chat', 'code', 'reasoning', 'long-context'],
        multiplier: 0.2,
      },
    ],
  },
  {
    key: 'moonshot',
    label: 'Moonshot Kimi',
    formats: [
      { type: ProviderType.OPENAI_COMPATIBLE, baseUrl: 'https://api.moonshot.cn/v1' },
    ],
    models: [
      {
        modelId: 'moonshot-v1-8k',
        displayName: 'Moonshot v1 8K',
        capabilities: ['chat', 'summarization'],
        multiplier: 0.3,
      },
      {
        modelId: 'moonshot-v1-32k',
        displayName: 'Moonshot v1 32K',
        capabilities: ['chat', 'code', 'long-context'],
        multiplier: 0.6,
      },
      {
        modelId: 'moonshot-v1-128k',
        displayName: 'Moonshot v1 128K',
        capabilities: ['chat', 'code', 'long-context', 'writing'],
        multiplier: 1.2,
      },
    ],
  },
  {
    key: 'kimi-code',
    label: 'Kimi Code',
    formats: [
      { type: ProviderType.OPENAI_COMPATIBLE, baseUrl: 'https://api.kimi.com/coding/v1' },
    ],
    models: [
      {
        modelId: 'k3',
        displayName: 'K3',
        capabilities: ['chat', 'code', 'reasoning', 'vision', 'long-context'],
        multiplier: 1,
      },
      {
        modelId: 'kimi-for-coding',
        displayName: 'Kimi for Coding',
        capabilities: ['chat', 'code', 'reasoning', 'vision', 'long-context'],
        multiplier: 0.5,
      },
      {
        modelId: 'kimi-for-coding-highspeed',
        displayName: 'Kimi for Coding HighSpeed',
        capabilities: ['chat', 'code', 'reasoning', 'vision', 'long-context'],
        multiplier: 0.8,
      },
    ],
  },
  {
    key: 'qwen',
    label: '通义千问 Qwen',
    formats: [
      { type: ProviderType.OPENAI_COMPATIBLE, baseUrl: 'https://maas.qianwenaiapi.com/compatible-mode/v1' },
    ],
    models: [
      {
        modelId: 'qwen-turbo',
        displayName: 'Qwen Turbo',
        capabilities: ['chat', 'summarization'],
        multiplier: 0.1,
      },
      {
        modelId: 'qwen-plus',
        displayName: 'Qwen Plus',
        capabilities: ['chat', 'code', 'reasoning'],
        multiplier: 0.2,
      },
      {
        modelId: 'qwen-max',
        displayName: 'Qwen Max',
        capabilities: ['chat', 'code', 'reasoning', 'writing'],
        multiplier: 0.6,
      },
    ],
  },
  {
    key: 'zhipu',
    label: '智谱 GLM',
    formats: [
      { type: ProviderType.OPENAI_COMPATIBLE, baseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
    ],
    models: [
      {
        modelId: 'glm-4-flash',
        displayName: 'GLM-4 Flash',
        capabilities: ['chat', 'summarization'],
        multiplier: 0.1,
      },
      {
        modelId: 'glm-4-air',
        displayName: 'GLM-4 Air',
        capabilities: ['chat', 'code', 'writing'],
        multiplier: 0.2,
      },
      {
        modelId: 'glm-4-plus',
        displayName: 'GLM-4 Plus',
        capabilities: ['chat', 'code', 'reasoning', 'long-context'],
        multiplier: 0.5,
      },
    ],
  },
  {
    key: 'minimax',
    label: 'MiniMax',
    formats: [
      { type: ProviderType.OPENAI_COMPATIBLE, baseUrl: 'https://api.minimax.chat/v1' },
    ],
    models: [
      {
        modelId: 'MiniMax-Text-01',
        displayName: 'MiniMax Text 01',
        capabilities: ['chat', 'code', 'reasoning', 'long-context'],
        multiplier: 0.3,
      },
    ],
  },
  {
    key: 'doubao',
    label: '豆包 Doubao',
    formats: [
      { type: ProviderType.OPENAI_COMPATIBLE, baseUrl: 'https://ark.cn-beijing.volces.com/api/v3' },
    ],
    models: [
      {
        modelId: 'doubao-lite-32k',
        displayName: 'Doubao Lite 32K',
        capabilities: ['chat', 'summarization'],
        multiplier: 0.1,
      },
      {
        modelId: 'doubao-pro-32k',
        displayName: 'Doubao Pro 32K',
        capabilities: ['chat', 'code', 'reasoning', 'writing'],
        multiplier: 0.3,
      },
    ],
  },
  {
    key: 'grok',
    label: 'xAI Grok',
    formats: [
      { type: ProviderType.OPENAI_COMPATIBLE, baseUrl: 'https://api.x.ai/v1' },
    ],
    models: [
      {
        modelId: 'grok-2-1212',
        displayName: 'Grok 2',
        capabilities: ['chat', 'code', 'reasoning', 'long-context'],
        multiplier: 0.6,
      },
    ],
  },
  {
    key: 'mistral',
    label: 'Mistral',
    formats: [
      { type: ProviderType.OPENAI_COMPATIBLE, baseUrl: 'https://api.mistral.ai/v1' },
    ],
    models: [
      {
        modelId: 'mistral-small-latest',
        displayName: 'Mistral Small',
        capabilities: ['chat', 'code', 'summarization'],
        multiplier: 0.2,
      },
      {
        modelId: 'mistral-large-latest',
        displayName: 'Mistral Large',
        capabilities: ['chat', 'code', 'reasoning', 'writing', 'long-context'],
        multiplier: 0.6,
      },
    ],
  },
];
