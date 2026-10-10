// Pure policy functions shared by the callable boundary and unit tests.
export function hasRecentAuthentication(authTime, now = Date.now()) {
  if (typeof authTime !== 'number' || !Number.isFinite(authTime)) return false;
  const age = now / 1000 - authTime;
  return age >= 0 && age <= 300;
}
export function nextAnalysisUsage(previous = {}, now = Date.now()) {
  const day = new Date(now).toISOString().slice(0, 10);
  const minute = Math.floor(now / 60000);
  const daily = previous.day === day ? previous.daily || 0 : 0;
  const recent = previous.minute === minute ? previous.recent || 0 : 0;
  if (daily >= 50 || recent >= 5) return null;
  return { day, minute, daily: daily + 1, recent: recent + 1 };
}
