export interface Scenario {
  id: string
  name: string
  description: string
  requiredCapabilities: string[]
  optionalCapabilities: string[]
  cacheHint: string
  tips: string[]
  examples: string[]
}

export interface ModelRef {
  id: string
  modelId: string
  displayName: string
  multiplier: number
  capabilities: string[]
}

export interface Recommendation {
  scenario: Scenario
  primary: ModelRef | null
  alternatives: ModelRef[]
  partialMatches: ModelRef[]
}
