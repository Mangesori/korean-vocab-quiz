import { format } from "date-fns";
import { ko } from "date-fns/locale";

export function formatDateShort(date: string | Date) {
  return format(new Date(date), "yyyy년 M월 d일", { locale: ko });
}

export function formatDateFull(date: string | Date) {
  return format(new Date(date), "yyyy년 M월 d일 a h:mm", { locale: ko });
}
