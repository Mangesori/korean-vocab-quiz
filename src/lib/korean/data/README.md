# 미사용 데이터

이 폴더의 세 파일은 지금 앱 코드에서 쓰이지 않는다.

- `grammar.json` — 국립국어원 표준 교육과정 문법 336개.
  AI 생성 프롬프트의 실제 문법 기준은
  `supabase/functions/_shared/grammar.ts`의 `GRAMMAR_ITEMS`다.
- `vocab.json`, `vocab-pos.json` — 국립국어원 기준 어휘 10,092개, 급수별 분류.

세 파일 모두 `scripts/build-korean-data.ts`가 만든다. `measure-baseline.ts`,
`audit-grammar-guide.ts`가 참고용으로 읽는다.
