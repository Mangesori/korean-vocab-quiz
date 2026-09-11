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

// 표 셀처럼 폭이 좁은 자리 전용 축약 형식 ("7/5").
export function formatDateCompact(date: string | Date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return format(d, "M/d", { locale: ko });
}

/** 오늘 · 어제 · 3일 전 · 3주 전 · 활동 없음 — 관리자 표의 "마지막 활동" 열 전용. */
export function formatRelativeKo(value: string | Date | null): string {
  if (!value) return '활동 없음';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return '활동 없음';
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return '오늘';
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  if (days < 35) return `${Math.floor(days / 7)}주 전`;
  return `${Math.floor(days / 30)}개월 전`;
}
