export function localDateIso(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfMonthIso(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

/** offset เป็นจำนวนวัน (+/-) จากวันที่ฐาน แล้วคืนค่าเป็น YYYY-MM-DD ตามเวลา local */
export function offsetDateIso(offsetDays: number, base: Date = new Date()): string {
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + offsetDays);
  return localDateIso(d);
}


