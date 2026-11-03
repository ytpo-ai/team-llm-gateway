import { request } from '@/lib/http'
import type {
  CreatePolicySetInput,
  PolicySet,
  UpdatePolicySetInput,
} from './types'

export function listPolicySets(): Promise<PolicySet[]> {
  return request<PolicySet[]>('/policy-sets')
}

export function getPolicySet(id: string): Promise<PolicySet> {
  return request<PolicySet>(`/policy-sets/${id}`)
}

export function createPolicySet(input: CreatePolicySetInput): Promise<PolicySet> {
  return request<PolicySet>('/policy-sets', {
    method: 'POST',
    body: input,
  })
}

export function updatePolicySet(
  id: string,
  patch: UpdatePolicySetInput,
): Promise<PolicySet> {
  return request<PolicySet>(`/policy-sets/${id}`, {
    method: 'PATCH',
    body: patch,
  })
}

export function deletePolicySet(id: string): Promise<PolicySet> {
  return request<PolicySet>(`/policy-sets/${id}`, { method: 'DELETE' })
}
