// Franja de aviso arriba de cada pestaña: enseña el primer aviso que el usuario no ha
// descartado, con "No volver a mostrar" (para siempre) y una X (hasta reabrir la app).
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import { useTheme } from '@/hooks/use-theme';
import { activeNotices, type AppNotice } from '@/lib/notices';
import { toDateKey } from '@/lib/schedule';
import { useDismissedNotices } from '@/stores/dismissedNotices';

export function NoticeBanner({ notices }: { notices: AppNotice[] }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const dismissed = useDismissedNotices((s) => s.dismissed);
  const closed = useDismissedNotices((s) => s.closed);
  const { dismiss, close } = useDismissedNotices.getState();
  const notice = notices.find((n) => !dismissed.includes(n.id) && !closed.includes(n.id));
  if (!notice) return null;
  return (
    <View testID="notice-banner" style={[styles.banner, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.texts}>
        <ThemedText type="small">{notice.text}</ThemedText>
        <Pressable accessibilityRole="button" onPress={() => dismiss(notice.id)} hitSlop={8}>
          <ThemedText type="smallBold">{t('notices.dontShowAgain')}</ThemedText>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('notices.close')}
        onPress={() => close(notice.id)}
        hitSlop={12}>
        <MaterialCommunityIcons name="close" size={20} color={theme.text} />
      </Pressable>
    </View>
  );
}

/** La franja con los avisos de hoy, calculados con los datos actuales y el idioma de la app. */
export function AppNoticeBanner() {
  const { t, i18n } = useTranslation();
  const { data } = useData();
  const lang = i18n.language === 'en' ? 'en' : 'es';
  return <NoticeBanner notices={activeNotices(data, toDateKey(new Date()), lang, t)} />;
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  texts: { flex: 1, gap: Spacing.one },
});
