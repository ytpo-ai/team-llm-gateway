// Protocol types for proxy policy — pure data, no Nest/Mongoose dependency.
// Mirrors policy-set.schema.ts enums but stands alone for serialization and cross-process portability.

/** What is being measured for a limit */
export enum Measure {
  TOKEN = 'token',
  REQUEST = 'request',
  CONCURRENCY = 'concurrency',
  SPEND = 'spend',
}

/** Time window over which a limit is enforced */
export enum Window {
  PERMANENT = 'permanent',
  MINUTE = 'minute',
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

/** Action when a limit is hit */
export enum Action {
  BLOCK = 'block',
  WARN = 'warn',
}

// ── StandardPolicy: pre-resolved policy snapshot ──

/** A single boolean gate pre-evaluated by the Resolver */
export interface StandardState {
  /** Stable identifier: 'balance_ok' | 'tenant_active' | 'key_active' | 'model_active' */
  name: string;
  /** Already evaluated by the Resolver */
  ok: boolean;
  /** block: reject when ok=false; warn: log but continue */
  action: Action;
  /** Stable error code when not ok, e.g. 'BALANCE_INSUFFICIENT' */
  code?: string;
  /** Human-readable message */
  message?: string;
}

/** A quantified usage limit that requires MeterBackend counting */
export interface StandardLimit {
  /** Aggregation scope for counting */
  scope: 'team' | 'member' | 'key';
  measure: Measure;
  window: Window;
  /** Positive threshold */
  limit: number;
  action: Action;
}

/** Fully resolved policy snapshot consumed by ProxyCore */
export interface StandardPolicy {
  version: 1;
  subject: {
    tenantId: string;
    teamId: string;
    userId: string;
    apiKeyId: string;
  };
  /** ① Pre-evaluated boolean gates */
  states: StandardState[];
  /** ② Set-membership allowlists (null = no restriction) */
  allowlists: {
    model: string[] | null;
    provider: string[] | null;
  };
  /** ③ Quantified limits that need counting */
  limits: StandardLimit[];
}

// ── StandardRequest / Candidate ──

/** Upstream channel descriptor (connection info pre-resolved by Resolver) */
export interface Candidate {
  providerId: string;
  /** Ascending priority (0 = highest) */
  priority: number;
  type: 'openai-compatible' | 'anthropic' | 'gemini';
  baseUrl: string;
  /** Already decrypted upstream key */
  apiKey: string;
  authType: string;
  /** Cost multiplier for token → spend conversion */
  multiplier: number;
}

/** Input to ProxyCore: policy snapshot + model + upstream candidates */
export interface StandardRequest {
  policy: StandardPolicy;
  modelId: string;
  /** Raw request body in the upstream protocol semantics */
  body: unknown;
  stream: boolean;
  /** Candidates already sorted by priority (ascending) */
  candidates: Candidate[];
}

// ── StandardResult ──

/** Output from ProxyCore after forwarding (or error) */
export interface StandardResult {
  requestId: string;
  modelId: string;
  /** Upstream channel that actually served the request */
  providerId?: string;
  status: 'success' | 'error' | 'exhausted';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Computed cost = multiplier × totalTokens */
  cost?: number;
  /** End-to-end latency in milliseconds */
  latencyMs: number;
  error?: {
    code: string;
    message: string;
  };
  /** Provider state changes for the business layer to persist */
  providerEvents?: Array<{
    providerId: string;
    event: 'exhausted' | 'rate-limit-headers';
    headers?: Record<string, string>;
  }>;
}