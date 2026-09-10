// test-irt.js — chạy: node test-irt.js
const { probabilityCorrect } = require('./src/services/irt/core');
const { estimateTheta, estimateThetaEAP } = require('./src/services/irt/ability');
const { selectNextItem } = require('./src/services/irt/itemSelector');

// ===== Phần 1: test cơ bản =====
const responses = [
  { a: 1.2, b: -1.0, c: 0.25, correct: true },
  { a: 1.0, b: 0.0,  c: 0.25, correct: true },
  { a: 1.5, b: 1.5,  c: 0.25, correct: false },
];

const theta1 = estimateTheta(responses);
console.log('Theta ước lượng:', theta1.toFixed(3));
console.log('P(đúng câu dễ)  =', probabilityCorrect(theta1, 1.2, -1.0, 0.25).toFixed(3));
console.log('P(đúng câu khó) =', probabilityCorrect(theta1, 1.5, 1.5, 0.25).toFixed(3));

// ===== Phần 2: mô phỏng bài thi thích ứng =====
const bank = [
  { id: 1, a: 1.0, b: -1.5, c: 0.25 },
  { id: 2, a: 1.2, b: -0.5, c: 0.25 },
  { id: 3, a: 1.0, b:  0.0, c: 0.25 },
  { id: 4, a: 1.3, b:  0.8, c: 0.25 },
  { id: 5, a: 1.5, b:  1.5, c: 0.25 },
];

let theta = 0;
let usedIds = [];
let history = [];

console.log('\n--- Mô phỏng bài thi thích ứng ---');
for (let step = 0; step < 4; step++) {
  const remaining = bank.filter((q) => !usedIds.includes(q.id));
  const nextItem = selectNextItem(theta, remaining);
  if (!nextItem) break;

  const correct = nextItem.b < theta + 0.5;

  usedIds.push(nextItem.id);
  history.push({ ...nextItem, correct });
  theta = estimateThetaEAP(history); // thay vì estimateTheta(history)

  console.log(`Câu ${nextItem.id} (b=${nextItem.b}) -> ${correct ? 'ĐÚNG' : 'SAI'} -> theta = ${theta.toFixed(3)}`);
}