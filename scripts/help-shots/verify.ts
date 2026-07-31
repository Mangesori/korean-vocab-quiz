// 도움말 콘텐츠 데이터 상호 참조 검증. 23개 문서 사이의 related/category/popular
// 링크는 눈으로 맞춰볼 수 없는 규모라 스크립트로 강제한다.
//
// 실행: npx tsx scripts/help-shots/verify.ts
import { ARTICLES, ARTICLE_ORDER, CATEGORY_GROUPS, POPULAR } from "../../src/data/help";
import type { HelpArticleId, HelpRole } from "../../src/data/help";

const errors: string[] = [];
const REMOVED_IDS = ["t-plan", "t-limit"];

const allIds = new Set<string>(ARTICLE_ORDER);

// 1. related id 실존
for (const id of ARTICLE_ORDER) {
  const article = ARTICLES[id];
  for (const relatedId of article.related) {
    if (!allIds.has(relatedId)) {
      errors.push(`[related] ${id} → 존재하지 않는 id "${relatedId}"`);
    }
  }
}

// 2 & 3. CATEGORY_GROUPS의 articleId 실존 + 모든 article이 정확히 하나의 카테고리
const categoryCountByArticle = new Map<string, number>();
for (const role of Object.keys(CATEGORY_GROUPS) as HelpRole[]) {
  for (const category of CATEGORY_GROUPS[role]) {
    for (const articleId of category.articleIds) {
      if (!allIds.has(articleId)) {
        errors.push(`[category] ${role}/${category.key} → 존재하지 않는 id "${articleId}"`);
        continue;
      }
      categoryCountByArticle.set(articleId, (categoryCountByArticle.get(articleId) ?? 0) + 1);

      // 5. article.role과 카테고리 role 일치
      const article = ARTICLES[articleId as HelpArticleId];
      if (article.role !== role) {
        errors.push(
          `[role mismatch] ${articleId}의 role은 "${article.role}"인데 카테고리 "${category.key}"는 role "${role}"에 속함`,
        );
      }
      // categoryKey 필드도 카테고리 그룹과 일치해야 한다
      if (article.categoryKey !== category.key) {
        errors.push(
          `[categoryKey mismatch] ${articleId}.categoryKey="${article.categoryKey}"인데 CATEGORY_GROUPS에는 "${category.key}"에 등록됨`,
        );
      }
    }
  }
}
for (const id of ARTICLE_ORDER) {
  const count = categoryCountByArticle.get(id) ?? 0;
  if (count === 0) errors.push(`[category] ${id} → 어떤 카테고리에도 속하지 않음`);
  if (count > 1) errors.push(`[category] ${id} → ${count}개 카테고리에 중복 소속`);
}

// 4. POPULAR 역할별 정확히 3개, 전부 실존
for (const role of Object.keys(POPULAR) as HelpRole[]) {
  const ids = POPULAR[role];
  if (ids.length !== 3) {
    errors.push(`[popular] ${role} → 3개여야 하는데 ${ids.length}개`);
  }
  for (const id of ids) {
    if (!allIds.has(id)) {
      errors.push(`[popular] ${role} → 존재하지 않는 id "${id}"`);
    } else if (ARTICLES[id as HelpArticleId].role !== role) {
      errors.push(`[popular] ${role} 목록에 다른 role 문서 "${id}"(role=${ARTICLES[id as HelpArticleId].role})가 있음`);
    }
  }
}

// 6. 삭제된 t-plan/t-limit 참조 0건 (related, POPULAR, CATEGORY_GROUPS, ARTICLES 키 자체)
for (const removedId of REMOVED_IDS) {
  if (allIds.has(removedId)) {
    errors.push(`[removed] "${removedId}"가 여전히 ARTICLES에 존재함`);
  }
  for (const id of ARTICLE_ORDER) {
    if (ARTICLES[id].related.includes(removedId)) {
      errors.push(`[removed] ${id}.related가 삭제된 "${removedId}"를 참조함`);
    }
  }
  for (const role of Object.keys(POPULAR) as HelpRole[]) {
    if ((POPULAR[role] as string[]).includes(removedId)) {
      errors.push(`[removed] POPULAR.${role}가 삭제된 "${removedId}"를 참조함`);
    }
  }
  for (const role of Object.keys(CATEGORY_GROUPS) as HelpRole[]) {
    for (const category of CATEGORY_GROUPS[role]) {
      if (category.articleIds.includes(removedId)) {
        errors.push(`[removed] CATEGORY_GROUPS.${role}/${category.key}가 삭제된 "${removedId}"를 참조함`);
      }
    }
  }
}

// 7. 모든 article의 steps.length가 2~6 범위
// (t-edit은 6가지 퀴즈 유형의 편집 화면이 서로 달라 유형당 한 단계씩 6단계다)
for (const id of ARTICLE_ORDER) {
  const steps = ARTICLES[id].steps;
  if (steps.length < 2 || steps.length > 6) {
    errors.push(`[steps] ${id} → steps.length=${steps.length} (2~6여야 함)`);
  }
}

// 8. 최종 문서 개수 — 선생님 13 + 학생 10 = 23
const teacherCount = ARTICLE_ORDER.filter((id) => ARTICLES[id].role === "teacher").length;
const studentCount = ARTICLE_ORDER.filter((id) => ARTICLES[id].role === "student").length;
if (teacherCount !== 13) errors.push(`[count] 선생님 문서 ${teacherCount}개 (13개여야 함)`);
if (studentCount !== 10) errors.push(`[count] 학생 문서 ${studentCount}개 (10개여야 함)`);
if (ARTICLE_ORDER.length !== 23) errors.push(`[count] 전체 문서 ${ARTICLE_ORDER.length}개 (23개여야 함)`);

if (errors.length > 0) {
  console.error(`도움말 콘텐츠 검증 실패 (${errors.length}건):\n`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
} else {
  console.log(
    `도움말 콘텐츠 검증 통과 — 선생님 ${teacherCount}개 + 학생 ${studentCount}개 = 총 ${ARTICLE_ORDER.length}개`,
  );
}
