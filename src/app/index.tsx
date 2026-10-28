// Ruta "/": redirige a la pestaña inicial (Cerca de mí).
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/(tabs)/cerca" />;
}
