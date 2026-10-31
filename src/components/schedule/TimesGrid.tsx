// Rejilla con todas las horas de paso del día. Si highlightNext es true (el día elegido es hoy),
// las horas ya pasadas salen en gris y la siguiente resaltada.
// Si hay notas de los PDF, cada hora marcada lleva su letra en pequeño y debajo va la leyenda.
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import type { TimeOfDay } from "@/data/schema";
import { useTheme } from "@/hooks/use-theme";
import { minutesOfDay, type NoteLegendEntry } from "@/lib/schedule";

interface Props {
  times: TimeOfDay[];
  now?: Date;
  highlightNext: boolean;
  /** Notas de esta parada (de `notesAt`): qué letra lleva cada hora y su leyenda. */
  notes?: { marks: Record<TimeOfDay, string>; legend: NoteLegendEntry[] };
  /** Nombre de cada parada por código, para "Solo hasta …". */
  stopNames?: Record<string, string>;
}

/** Lo que se lee de una nota: "Solo hasta X" si es una retirada; si no, el texto oficial tal cual. */
export function noteLabel(
  entry: NoteLegendEntry,
  stopNames: Record<string, string>,
  t: TFunction,
): string {
  const stop = entry.endsAt ? stopNames[entry.endsAt] : undefined;
  return stop ? t("schedule.onlyTo", { stop }) : entry.text;
}

export function TimesGrid({
  times,
  now = new Date(),
  highlightNext,
  notes,
  stopNames = {},
}: Props) {
  const { t } = useTranslation();
  const theme = useTheme();

  if (times.length === 0) {
    return (
      <ThemedText themeColor="textSecondary">
        {t("schedule.noService")}
      </ThemedText>
    );
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  // La siguiente es la primera hora que aún no ha pasado (las horas vienen ordenadas).
  const nextIndex = highlightNext
    ? times.findIndex((time) => minutesOfDay(time) >= nowMinutes)
    : -1;

  // Texto de cada letra (solo las que salen en esta parada).
  const labels = new Map(
    (notes?.legend ?? []).map((e) => [e.mark, noteLabel(e, stopNames, t)]),
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        {times.map((time, index) => {
          const isNext = index === nextIndex;
          const isPast =
            highlightNext && (nextIndex === -1 || index < nextIndex);
          const mark = notes?.marks[time];
          const label = mark ? labels.get(mark) : undefined;
          const textStyle = isNext
            ? { color: theme.background }
            : isPast
              ? { color: theme.textSecondary, opacity: 0.6 }
              : undefined;
          return (
            <View
              key={`${time}-${index}`}
              testID={isNext ? "time-next" : isPast ? "time-past" : undefined}
              // El lector de pantalla dice la nota entera ("21:38, solo hasta Moreno Mendoza"), no solo la letra.
              accessible
              accessibilityLabel={
                label
                  ? `${time}, ${label.charAt(0).toLowerCase()}${label.slice(1)}`
                  : time
              }
              style={[
                styles.cell,
                {
                  backgroundColor: isNext
                    ? theme.text
                    : theme.backgroundElement,
                },
              ]}
            >
              <ThemedText
                type={isNext ? "smallBold" : "small"}
                style={textStyle}
              >
                {time}
                {mark ? (
                  <ThemedText type="small" style={[styles.mark, textStyle]}>
                    {mark}
                  </ThemedText>
                ) : null}
              </ThemedText>
            </View>
          );
        })}
      </View>
      {labels.size > 0 ? (
        <View testID="notes-legend" style={styles.legend}>
          {[...labels].map(([m, text]) => (
            <ThemedText key={m} type="small" themeColor="textSecondary">
              {`${m}: ${text}`}
            </ThemedText>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  legend: { gap: Spacing.one },
  // La letra va pegada a la hora, más pequeña.
  mark: { fontSize: 11, lineHeight: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  cell: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
    minWidth: 60,
    alignItems: "center",
  },
});
