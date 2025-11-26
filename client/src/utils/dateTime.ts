export function getDate(date: string): string {
  const iso = new Date(date).toISOString();                // ex: 2025-11-10T14:25:36.123Z
  const [year, month, day] = iso.split("T")[0].split("-");

  return `${day}/${month}/${year}`;
}

export function getTime(date: string): string {
  const iso = new Date(date).toISOString();
  const timePart = iso.split("T")[1];            // ex: 14:25:36.123Z
  const [hour, minute] = timePart.split(":");

  return `${hour}:${minute}`;
}

export function getDateTime(date: string): string {
  return `${getDate(date)}, ${getTime(date)}`;
}
