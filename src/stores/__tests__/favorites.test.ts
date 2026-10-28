// Pruebas del store de favoritos (paradas guardadas por línea).
import { useFavorites } from '../favorites';

const a = { lineId: 'L1', stopCode: '001' };
const b = { lineId: 'L2', stopCode: '002' };

describe('useFavorites', () => {
  beforeEach(() => {
    useFavorites.setState({ items: [] });
  });

  it('empieza sin favoritos', () => {
    expect(useFavorites.getState().items).toEqual([]);
  });

  it('toggle añade un favorito', () => {
    useFavorites.getState().toggle(a);
    expect(useFavorites.getState().items).toEqual([a]);
  });

  it('un segundo toggle del mismo favorito lo quita', () => {
    useFavorites.getState().toggle(a);
    useFavorites.getState().toggle(a);
    expect(useFavorites.getState().items).toEqual([]);
  });

  it('no deja duplicados al alternar varios favoritos', () => {
    const { toggle } = useFavorites.getState();
    toggle(a);
    toggle(b);
    toggle(a);
    expect(useFavorites.getState().items).toEqual([b]);
  });

  it('isFavorite refleja si la parada está guardada', () => {
    const store = useFavorites.getState;
    expect(store().isFavorite(a)).toBe(false);
    store().toggle(a);
    expect(useFavorites.getState().isFavorite(a)).toBe(true);
    expect(useFavorites.getState().isFavorite(b)).toBe(false);
    useFavorites.getState().toggle(a);
    expect(useFavorites.getState().isFavorite(a)).toBe(false);
  });

  it('el favorito más nuevo va primero', () => {
    useFavorites.getState().toggle(a);
    useFavorites.getState().toggle(b);
    expect(useFavorites.getState().items).toEqual([b, a]);
  });
});
