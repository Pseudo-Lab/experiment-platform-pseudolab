// An educational browser-only model, not Iterglow's production bucketing algorithm.
function bucket(id, stage) {
  let hash = 2166136261;
  for (const character of `${stage}:${id}`) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296 * 100;
}

export function assignVisitor(assignments, id, participation, aShare) {
  if (typeof id !== 'string' || !id) throw new TypeError('A synthetic visitor ID is required');
  if (![participation, aShare].every(value => Number.isFinite(value) && value >= 0 && value <= 100)) {
    throw new RangeError('Percentages must be between 0 and 100');
  }
  if (assignments.has(id)) return assignments.get(id);
  const outcome = bucket(id, 'participation') >= participation
    ? 'outside'
    : (bucket(id, 'variant') < aShare ? 'A' : 'B');
  assignments.set(id, outcome);
  return outcome;
}
