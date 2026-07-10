import { format } from "date-fns";
import { ko } from "date-fns/locale";

export function formatDateShort(date: string | Date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return format(d, "yyyy년 M월 d일", { locale: ko });
}

export function formatDateFull(date: string | Date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return format(d, "yyyy년 M월 d일 a h:mm", { locale: ko });
}
