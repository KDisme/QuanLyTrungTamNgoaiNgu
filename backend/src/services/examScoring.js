function roundToHalf(value) {
  const number = Number(value || 0);
  return Math.round(number * 2) / 2;
}

function average(values = []) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
}

function calculateWritingScore(items = []) {
  const task1Values = items.filter((item) => /task.?1/i.test(item.part || '')).map((item) => Number(item.score || 0));
  const task2Values = items.filter((item) => /task.?2/i.test(item.part || '')).map((item) => Number(item.score || 0));
  const task1 = average(task1Values);
  const task2 = average(task2Values);
  if (task1 !== null && task2 !== null) {
    return { score10: roundToHalf(task1 / 3 + task2 * 2 / 3), task1Score: roundToHalf(task1), task2Score: roundToHalf(task2) };
  }
  const fallback = average(items.map((item) => Number(item.score || 0)));
  return fallback === null ? null : { score10: roundToHalf(fallback) };
}

function calculateSpeakingScore(items = []) {
  const score = average(items.map((item) => Number(item.score || 0)));
  return score === null ? null : { score10: roundToHalf(score) };
}

function calculateVstepOverall(skillScores = {}) {
  const required = ['Listening', 'Reading', 'Writing', 'Speaking'];
  const values = required.map((skill) => Number(skillScores[skill]?.score10));
  if (values.some(Number.isNaN)) return null;
  return roundToHalf(values.reduce((sum, value) => sum + value, 0) / values.length);
}

module.exports = { roundToHalf, calculateWritingScore, calculateSpeakingScore, calculateVstepOverall };
