// Pruebas del buscador de lugares: solo busca al pulsar Buscar o Intro y enseña la lista y los errores.
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { initI18n } from '@/i18n';
import { type Place, SearchError } from '@/lib/placeSearch';

import { PlaceSearch } from '../PlaceSearch';

const luz: Place = { id: 'N1', name: 'Calle Luz', detail: 'Centro', lat: 36.68, lon: -6.13 };

beforeAll(() => {
  initI18n('es');
});

async function setup(search: jest.Mock, extra: { onOffline?: () => void } = {}) {
  const onPick = jest.fn();
  await render(<PlaceSearch placeholder="Escribe el destino" onPick={onPick} search={search} {...extra} />);
  return onPick;
}

describe('PlaceSearch', () => {
  it('escribir sin pulsar Buscar no llama a la búsqueda', async () => {
    const search = jest.fn().mockResolvedValue([]);
    await setup(search);
    await fireEvent.changeText(screen.getByLabelText('Buscar un lugar'), 'Luz');
    expect(search).not.toHaveBeenCalled();
  });

  it('el botón Buscar enseña la lista y al tocar un lugar avisa con onPick', async () => {
    const search = jest.fn().mockResolvedValue([luz]);
    const onPick = await setup(search);
    await fireEvent.changeText(screen.getByLabelText('Buscar un lugar'), 'Luz');
    await fireEvent.press(screen.getByRole('button', { name: 'Buscar' }));
    expect(search).toHaveBeenCalledWith('Luz');
    await fireEvent.press(await screen.findByRole('button', { name: 'Calle Luz, Centro' }));
    expect(onPick).toHaveBeenCalledWith(luz);
  });

  it('Intro (onSubmitEditing) también busca', async () => {
    const search = jest.fn().mockResolvedValue([luz]);
    await setup(search);
    await fireEvent.changeText(screen.getByLabelText('Buscar un lugar'), 'Luz');
    await fireEvent(screen.getByLabelText('Buscar un lugar'), 'submitEditing');
    expect(await screen.findByText('Calle Luz')).toBeTruthy();
  });

  it('con menos de 3 letras avisa y no busca', async () => {
    const search = jest.fn();
    await setup(search);
    await fireEvent.changeText(screen.getByLabelText('Buscar un lugar'), 'Lu');
    await fireEvent.press(screen.getByRole('button', { name: 'Buscar' }));
    expect(screen.getByText('Escribe al menos 3 letras')).toBeTruthy();
    expect(search).not.toHaveBeenCalled();
  });

  it('0 resultados: "No hemos encontrado ese sitio en Jerez"', async () => {
    await setup(jest.fn().mockResolvedValue([]));
    await fireEvent.changeText(screen.getByLabelText('Buscar un lugar'), 'Zzzz');
    await fireEvent.press(screen.getByRole('button', { name: 'Buscar' }));
    expect(await screen.findByText('No hemos encontrado ese sitio en Jerez')).toBeTruthy();
  });

  it('busy: avisa de que está saturada', async () => {
    await setup(jest.fn().mockRejectedValue(new SearchError('busy')));
    await fireEvent.changeText(screen.getByLabelText('Buscar un lugar'), 'Luz');
    await fireEvent.press(screen.getByRole('button', { name: 'Buscar' }));
    expect(await screen.findByText('La búsqueda está saturada, prueba en un rato')).toBeTruthy();
  });

  it('failed: avisa y "Reintentar" repite la búsqueda', async () => {
    const search = jest.fn().mockRejectedValueOnce(new SearchError('failed')).mockResolvedValue([luz]);
    await setup(search);
    await fireEvent.changeText(screen.getByLabelText('Buscar un lugar'), 'Luz');
    await fireEvent.press(screen.getByRole('button', { name: 'Buscar' }));
    expect(await screen.findByText('No se pudo buscar.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Calle Luz')).toBeTruthy();
    expect(search).toHaveBeenCalledTimes(2);
  });

  it('offline: avisa a la pantalla con onOffline', async () => {
    const onOffline = jest.fn();
    await setup(jest.fn().mockRejectedValue(new SearchError('offline')), { onOffline });
    await fireEvent.changeText(screen.getByLabelText('Buscar un lugar'), 'Luz');
    await fireEvent.press(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(onOffline).toHaveBeenCalledTimes(1));
  });
});
