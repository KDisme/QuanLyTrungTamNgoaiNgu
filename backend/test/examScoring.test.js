const test = require('node:test');
const assert = require('node:assert/strict');
const { roundToHalf, calculateWritingScore, calculateSpeakingScore, calculateVstepOverall } = require('../src/services/examScoring');

test('rounds VSTEP scores to the nearest 0.5', () => {
  assert.equal(roundToHalf(6.24), 6);
  assert.equal(roundToHalf(6.25), 6.5);
  assert.equal(roundToHalf(8.76), 9);
});

test('weights Writing Task 1 at one third and Task 2 at two thirds', () => {
  assert.deepEqual(calculateWritingScore([
    { part: 'Writing Task 1', score: 6 },
    { part: 'Writing Task 2', score: 9 },
  ]), { score10: 8, task1Score: 6, task2Score: 9 });
});

test('averages Speaking parts and calculates four-skill overall', () => {
  assert.deepEqual(calculateSpeakingScore([{ score: 6 }, { score: 7 }, { score: 8 }]), { score10: 7 });
  assert.equal(calculateVstepOverall({
    Listening: { score10: 7 }, Reading: { score10: 8 }, Writing: { score10: 8 }, Speaking: { score10: 7 },
  }), 7.5);
  assert.equal(calculateVstepOverall({ Listening: { score10: 7 } }), null);
});
