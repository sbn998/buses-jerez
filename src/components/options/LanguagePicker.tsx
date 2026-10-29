// Selector de idioma de Opciones: Automático / Español / English.
// Guarda la elección en los ajustes; el layout raíz cambia el idioma al instante.
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { Language } from '@/i18n';
import { useSettings } from '@/stores/settings';

const OPCIONES: { value: Language; labelKey: string }[] = [
  { value: 'auto', labelKey: 'options.langAuto' },
  { value: 'es', labelKey: 'options.langEs' },
  { value: 'en', labelKey: 'options.langEn' },
];

export function LanguagePicker() {
  const { t } = useTranslation();
  const language = useSettings((s) => s.language);
  const setLanguage = useSettings((s) => s.setLanguage);
  return (
    <View style={styles.row}>
      {OPCIONES.map((o) => (
        <Pressable
          key={o.value}
          accessibilityRole="radio"
          accessibilityState={{ selected: language === o.value }}
          onPress={() => setLanguage(o.value)}
          style={styles.option}>
          <ThemedText type={language === o.value ? 'linkPrimary' : 'default'}>{t(o.labelKey)}</ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
});
