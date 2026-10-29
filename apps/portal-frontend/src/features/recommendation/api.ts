import { request } from '@/lib/http'
import type { Recommendation, Scenario } from './types'

export function listScenarios(): Promise<Scenario[]> {
  return request<Scenario[]>('/recommendations/scenarios')
}

export function getRecommendation(scenarioId: string): Promise<Recommendation> {
  return request<Recommendation>(
    `/recommendations/scenarios/${encodeURIComponent(scenarioId)}`,
  )
}
