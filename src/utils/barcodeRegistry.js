const KEY = 'pm_barcode_registry';

export function getRegistry() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

function saveRegistry(registry) {
  localStorage.setItem(KEY, JSON.stringify(registry));
}

/** 라벨 출력 시 호출 — 신규 등록 및 printed=true 마킹 */
export function registerBarcodes(items) {
  const registry = getRegistry();
  const today = new Date().toISOString().split('T')[0];

  for (const item of items) {
    const code = item.custom_product_code;
    if (!code) continue;

    if (!registry[code]) {
      registry[code] = {
        code,
        productName: item.product_name || '',
        cafe24ProductNo: String(item.product_no || ''),
        format: 'CODE128',
        generatedAt: today,
        printed: false,
        scannedCount: 0,
        lastScanned: null,
        mismatchCount: 0,
      };
    }
    registry[code].printed = true;
    registry[code].productName = item.product_name || registry[code].productName;
  }

  saveRegistry(registry);
}

/** 스캔 이벤트 기록 */
export function recordScan(code, isMatch) {
  const registry = getRegistry();
  if (!registry[code]) return;
  registry[code].scannedCount = (registry[code].scannedCount || 0) + 1;
  registry[code].lastScanned = new Date().toISOString();
  if (!isMatch) {
    registry[code].mismatchCount = (registry[code].mismatchCount || 0) + 1;
  }
  saveRegistry(registry);
}

/** 바코드 코드 조회 */
export function lookupBarcode(code) {
  return getRegistry()[code] || null;
}

/** 바코드 삭제 */
export function deleteBarcode(code) {
  const registry = getRegistry();
  delete registry[code];
  saveRegistry(registry);
}
