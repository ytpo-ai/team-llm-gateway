import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface TeamContextState {
  selectedTeamId: string | null
  setSelectedTeamId: (id: string | null) => void
}

export const useTeamContextStore = create<TeamContextState>()(
  persist(
    (set) => ({
      selectedTeamId: null,
      setSelectedTeamId: (id) => set({ selectedTeamId: id }),
    }),
    {
      name: 'portal-team-context',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
