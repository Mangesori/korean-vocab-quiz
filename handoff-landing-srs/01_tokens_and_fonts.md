# 01 · 색 토큰과 폰트 정리

**모든 작업의 선행.** 기계적이라 한 번에 끝냅니다.

---

## 폰트 — 죽은 코드 제거

`src/components/landing/HeroProductMock.tsx`가 `DM Serif Display`와 `Geist`를 인라인으로 지정하지만,
`index.html`은 **Pretendard만** 불러옵니다. 그 두 폰트는 로드되지 않고 시스템 기본 serif/sans로 떨어집니다.

`tailwind.config.ts`의 `fontFamily`는 `sans`/`brand`/`ui`/`mono` **전부 Pretendard 별칭**입니다.

### 할 일

- `HeroProductMock.tsx`에서 `fontFamily: "DM Serif Display"`, `"Geist"`, `"Geist Mono"` 지정 전부 삭제
- 숫자가 나란히 서야 하는 곳(점수·카운터·퍼센트)에 `tabular-nums`
- 제목의 무게감이 필요하면 `font-brand font-black`(Pretendard 900)

---

## 색 — 하드코딩된 근사값 교체

목업에 쓰인 값들이 실제 토큰과 미세하게 다릅니다. 눈으로는 안 보이지만 나란히 놓으면 어긋납니다.

| 잘못된 값 | 올바른 값 | 무엇 |
|---|---|---|
| `#1E6B47` | `#1F6B48` | primary |
| `#E8F5EE` | `#DCF0E4` | accent (레벨 배지 배경) |
| `#E2DDD8` | `#E5DFDA` | border |
| `#F8FAFC` | `#FAF8F5` | 프롬프트 패널 (차가운 회색 → 따뜻한 베이지) |

### 전체 토큰 (`src/index.css`)

| 토큰 | HSL | HEX |
|---|---|---|
| `--primary` | `152 55% 27%` | `#1F6B48` |
| `--background` | `40 20% 97%` | `#F9F7F4` |
| `--foreground` | `20 14% 10%` | `#1B1917` |
| `--border` | `35 15% 88%` | `#E5DFDA` |
| `--accent` | `152 40% 90%` | `#DCF0E4` |
| `--secondary` | `40 15% 97%` | `#F9F7F4` ⚠ background와 사실상 동일 |
| `--muted-foreground` | — | `#6B635E` |
| `--warning` | `38 72% 45%` | `#B4831C` |

### 스테이지에 하드코딩된 값 (토큰 아님, 그대로 유지)

| 값 | 무엇 |
|---|---|
| `#FAF8F5` | 프롬프트 패널 배경 |
| `#EBE5DE` | 타일·버튼 테두리 |
| `#F4F0EA` | 조사 타일, 카운터 알약 |
| `#8A837D` | 조사 타일 글자 |
| `#8B5CF6` | 말하기 유형 배지 (+ 10% 배경) |

### ⚠ `--secondary`가 `--background`와 같습니다

`bg-secondary`를 쓰는 요소는 페이지 위에서 **보이지 않습니다**. 대표적으로 진행 바 트랙(`ui/progress.tsx`의 `bg-secondary`).

02에서 이 문제를 다룹니다. 여기서는 토큰을 함부로 바꾸지 마세요 — `--secondary`를 조정하면 shadcn 컴포넌트 전반에 영향이 갑니다.

---

## 비활성 버튼

목업이 비활성 CTA를 회색(`#E2DDD8`)으로 그렸는데, 실제는 **`primary/50`(연한 초록)** 입니다.
`disabled:opacity-50`이 primary 배경에 걸려서 나오는 색입니다. 회색으로 바꾸지 마세요.

---

## 로고

`AppSidebar.tsx`는 `NamuLogo` 컴포넌트가 아니라 `/Namu_logo_text_right.png` 이미지를 씁니다.
히어로 목업에는 사이드바가 없어졌으니 필요 없지만, 다른 화면 목업을 추가할 때는 이 이미지를 쓸 것.
