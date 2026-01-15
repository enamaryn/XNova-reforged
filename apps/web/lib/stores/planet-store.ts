import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface PlanetState {
  selectedPlanetId: string | null;
  setSelectedPlanetId: (id: string | null) => void;
}

export const usePlanetStore = create<PlanetState>()(
  persist(
    (set) => ({
      selectedPlanetId: null,
      setSelectedPlanetId: (id) => set({ selectedPlanetId: id }),
    }),
    {
      name: 'xnova-planet',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
