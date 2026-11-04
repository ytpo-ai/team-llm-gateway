import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface TeamContextState {
  selectedTenantId: string | null
  setSelectedTenantId: (id: string | null) => void
}

export const useTeamContextStore = create<TeamContextState>()(
  persist(
    (set) => ({
      selectedTenantId: null,
      setSelectedTenantId: (id) => set({ selectedTenantId: id }),
    }),
    {
      name: 'portal-tenant-context',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
