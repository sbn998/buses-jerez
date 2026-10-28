// Ajustes de la app guardados en el móvil (de momento solo el idioma).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Language } from '@/i18n';

type SettingsState = {
  language: Language;
  setLanguage: (l: Language) => void;
};

// "persist" guarda el estado en AsyncStorage bajo la clave "settings".
export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'auto',
      setLanguage: (language) => set({ language }),
    }),
    { name: 'settings', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
