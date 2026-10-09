export interface ProductionEntry {
  id: string;
  shipId: number;
  startTime: Date;
  endTime: Date;
  createdAt: Date;
}
/** Preserve every started legacy lot. Reschedule waiting lots, in FIFO order, without overlapping a type. */
export function scheduleProduction<T extends ProductionEntry>(
  queue: T[],
  capacity: number,
  now: Date,
) {
  const active = queue.filter((q) => q.startTime <= now);
  const waiting = queue
    .filter((q) => q.startTime > now)
    .sort(
      (a, b) =>
        a.createdAt.getTime() - b.createdAt.getTime() ||
        a.id.localeCompare(b.id),
    );
  const lanes = Array.from({ length: Math.max(capacity, active.length) }, () =>
    now.getTime(),
  );
  const types = new Map<number, number>();
  active.forEach((q, index) => {
    lanes[index] = Math.max(now.getTime(), q.endTime.getTime());
    types.set(q.shipId, Math.max(types.get(q.shipId) ?? 0, lanes[index]));
  });
  // Legacy excess lots finish, but do not create extra lanes for subsequent work.
  if (active.length > capacity) {
    const retained = [...lanes].sort((a, b) => b - a).slice(0, capacity);
    lanes.splice(0, lanes.length, ...retained);
  }
  const result: Array<{ id: string; startTime: Date; endTime: Date }> = [];
  let previousStart = now.getTime();
  for (const q of waiting) {
    const lane = lanes.indexOf(Math.min(...lanes));
    const start = Math.max(
      lanes[lane],
      types.get(q.shipId) ?? 0,
      previousStart,
    );
    const end =
      start + Math.max(1, q.endTime.getTime() - q.startTime.getTime());
    result.push({
      id: q.id,
      startTime: new Date(start),
      endTime: new Date(end),
    });
    lanes[lane] = end;
    types.set(q.shipId, end);
    previousStart = start;
  }
  return result;
}
