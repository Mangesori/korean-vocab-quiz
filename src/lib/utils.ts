import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 정수 퍼센트. 분모 0이면 0(막대·정렬용 — 표시는 호출부에서 0값 처리). */
export function pct(count: number, total: number): number {
  if (!total) return 0;
  return Math.round((count / total) * 100);
}
