// Avisos descartados por el usuario.
// - "No volver a mostrar" guarda el id en el móvil para siempre (`dismissed`).
// - Cerrar solo lo oculta mientras la app sigue abierta (`closed`, no se guarda).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type DismissedNoticesState = {
  dismissed: string[];
  closed: string[];
  dismiss: (id: string) => void;
  close: (id: string) => void;
  isDismissed: (id: string) => boolean;
};

// "persist" guarda solo la lista `dismissed` en AsyncStorage bajo la clave "dismissed-notices".
export const useDismissedNotices = create<DismissedNoticesState>()(
  persist(
    (set, get) => ({
      dismissed: [],
      closed: [],
      dismiss: (id) => set((s) => (s.dismissed.includes(id) ? s : { dismissed: [...s.dismissed, id] })),
      close: (id) => set((s) => (s.closed.includes(id) ? s : { closed: [...s.closed, id] })),
      isDismissed: (id) => get().dismissed.includes(id),
    }),
    {
      name: 'dismissed-notices',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ dismissed: s.dismissed }),
    },
  ),
);
