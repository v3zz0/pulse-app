export const reminderTypes = {
  meal: { name: "Pasto", icon: "food", target: true },
  supplement: { name: "Integratore", icon: "pill", target: true },
  workout: { name: "Allenamento", icon: "dumbbell", target: true },
  weight: { name: "Peso", icon: "weight", target: false },
  custom: { name: "Personalizzato", icon: "bell", target: false },
};
export const reminderDays = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
export const orderedDays = [1, 2, 3, 4, 5, 6, 0];
export function reminderFrequency(days) {
  return days.length === 7
    ? "Ogni giorno"
    : orderedDays.filter((day) => days.includes(day)).map((day) => reminderDays[day]).join(" · ");
}
