// Favoritos: paradas guardadas por el usuario (línea + parada), guardadas en el móvil.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Una parada guardada: la línea y el código de la parada.
export interface Favorite {
  lineId: string;
  stopCode: string;
}

type FavoritesState = {
  items: Favorite[];
  toggle: (f: Favorite) => void;
  isFavorite: (f: Favorite) => boolean;
};

// Dos favoritos son iguales si tienen la misma línea y la misma parada.
function same(a: Favorite, b: Favorite): boolean {
  return a.lineId === b.lineId && a.stopCode === b.stopCode;
}

// "persist" guarda la lista en AsyncStorage bajo la clave "favorites".
export const useFavorites = create<FavoritesState>()(
  persist(
    (set, get) => ({
      items: [],
      // Si ya estaba guardado lo quita; si no, lo añade al principio (el más nuevo primero).
      toggle: (f) =>
        set((state) => ({
          items: state.items.some((x) => same(x, f))
            ? state.items.filter((x) => !same(x, f))
            : [f, ...state.items],
        })),
      isFavorite: (f) => get().items.some((x) => same(x, f)),
    }),
    { name: 'favorites', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
