import { classifyByCode, MAJOR_ZONES, compareSubcategories, sortByProductCode } from './zones.js';

/**
 * 아이템 배열 → 대분류/소분류 2단 그룹 구조 생성
 * PickingView와 BulkPrintView 공용
 */
export function buildZoneGroups(items, zoneOverrides = {}) {
  const majorMap = {};

  for (const item of items) {
    const effectiveCode = zoneOverrides[item.order_item_code] ?? item.custom_product_code;
    const { major, letter, subLabel } = classifyByCode(effectiveCode);
    const letterKey = letter ?? '__none__';

    if (!majorMap[major]) majorMap[major] = {};
    if (!majorMap[major][letterKey]) {
      majorMap[major][letterKey] = { letter, subLabel, items: [] };
    }
    majorMap[major][letterKey].items.push(item);
  }

  for (const subMap of Object.values(majorMap)) {
    for (const sub of Object.values(subMap)) {
      sub.items.sort(sortByProductCode);
    }
  }

  return MAJOR_ZONES
    .filter(mz => majorMap[mz.id])
    .map(mz => {
      const subMap = majorMap[mz.id];
      const subcategories = Object.values(subMap)
        .sort((a, b) => compareSubcategories(mz.id, a.letter, b.letter));
      const totalItems = subcategories.reduce((n, s) => n + s.items.length, 0);
      return { ...mz, subcategories, totalItems };
    });
}
