import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_YEAR, MIN_YEAR, canShift, cellState, daysInMonth, gridMoveForKey, isEligible, monthDates, monthStats, moveCell, msUntilMidnight, shiftMonth, visibleHabits, withYear } from '../src/calendar.ts';

const habit = (id, sortOrder, startDate, archivedAt = null) => ({ id, name: id, sortOrder, startDate, archivedAt });

test('month navigation crosses year boundaries both ways', () => {
  assert.deepEqual(shiftMonth({ year: 2026, month: 12 }, 1), { year: 2027, month: 1 });
  assert.deepEqual(shiftMonth({ year: 2027, month: 1 }, -1), { year: 2026, month: 12 });
  assert.deepEqual(shiftMonth({ year: 2026, month: 11 }, 14), { year: 2028, month: 1 });
  assert.deepEqual(shiftMonth({ year: 2026, month: 3 }, -27), { year: 2023, month: 12 });
  assert.deepEqual(shiftMonth({ year: 2026, month: 5 }, 0), { year: 2026, month: 5 });
});

test('navigation stops at the supported years instead of producing invalid dates', () => {
  assert.deepEqual(shiftMonth({ year: MIN_YEAR, month: 1 }, -1), { year: MIN_YEAR, month: 1 });
  assert.deepEqual(shiftMonth({ year: MAX_YEAR, month: 12 }, 1), { year: MAX_YEAR, month: 12 });
  assert.equal(canShift({ year: MIN_YEAR, month: 1 }, -1), false);
  assert.equal(canShift({ year: MAX_YEAR, month: 11 }, 1), true);
  assert.deepEqual(withYear({ year: 2026, month: 2 }, 12000), { year: MAX_YEAR, month: 2 });
  assert.deepEqual(withYear({ year: 2026, month: 2 }, 2025), { year: 2025, month: 2 });
});

test('month dates follow leap-year rules', () => {
  assert.equal(daysInMonth(2028, 2), 29);
  assert.equal(daysInMonth(2026, 2), 28);
  assert.equal(daysInMonth(2100, 2), 28);
  assert.equal(daysInMonth(2000, 2), 29);
  const feb = monthDates({ year: 2028, month: 2 });
  assert.equal(feb.length, 29);
  assert.equal(feb[0], '2028-02-01');
  assert.equal(feb.at(-1), '2028-02-29');
  assert.equal(monthDates({ year: 2026, month: 12 }).at(-1), '2026-12-31');
});

test('columns keep the saved order and archived habits stay in their historical months', () => {
  const habits = [habit('late', 2, '2026-11-20'), habit('retired', 0, '2026-09-01', '2026-10-15'), habit('daily', 1, '2026-09-01')];
  const ids = month => visibleHabits(habits, monthDates(month)).map(h => h.id);
  assert.deepEqual(ids({ year: 2026, month: 10 }), ['retired', 'daily']);
  assert.deepEqual(ids({ year: 2026, month: 11 }), ['daily', 'late']);
  assert.deepEqual(ids({ year: 2026, month: 8 }), []);
  // The archive day itself is still active.
  assert.equal(isEligible(habits[1], '2026-10-15'), true);
  assert.equal(isEligible(habits[1], '2026-10-16'), false);
});

test('cell states: inactive before start and after archive, future after today', () => {
  const h = habit('h', 0, '2026-11-03', '2026-11-20');
  assert.equal(cellState(h, '2026-11-02', '2026-11-10'), 'inactive');
  assert.equal(cellState(h, '2026-11-03', '2026-11-10'), 'open');
  assert.equal(cellState(h, '2026-11-11', '2026-11-10'), 'future');
  assert.equal(cellState(h, '2026-11-21', '2026-11-30'), 'inactive');
});

test('monthly rate counts only eligible habit-days through today', () => {
  const habits = [habit('a', 0, '2026-11-01'), habit('b', 1, '2026-11-04', '2026-11-05')];
  const done = new Set(['a|2026-11-01', 'a|2026-11-02', 'b|2026-11-04', 'a|2026-11-30']);
  const stats = monthStats(habits, monthDates({ year: 2026, month: 11 }), (id, d) => done.has(`${id}|${d}`), '2026-11-05');
  // a: 5 eligible days (1–5), b: 2 (4–5) → 7; completions within them: 3 (the 30th is in the future).
  assert.deepEqual(stats, { completed: 3, eligible: 7, rate: 43 });
  assert.deepEqual(monthStats([], [], () => false, '2026-11-05'), { completed: 0, eligible: 0, rate: 0 });
});

test('grid keys move focus within the grid and never wrap out of it', () => {
  assert.deepEqual(moveCell(0, 0, 'left', 30, 4), [0, 0]);
  assert.deepEqual(moveCell(0, 0, 'up', 30, 4), [0, 0]);
  assert.deepEqual(moveCell(5, 3, 'right', 30, 4), [5, 3]);
  assert.deepEqual(moveCell(29, 1, 'down', 30, 4), [29, 1]);
  assert.deepEqual(moveCell(10, 2, 'row-start', 30, 4), [10, 0]);
  assert.deepEqual(moveCell(10, 2, 'row-end', 30, 4), [10, 3]);
  assert.deepEqual(moveCell(10, 2, 'page-down', 30, 4), [17, 2]);
  assert.deepEqual(moveCell(26, 2, 'page-down', 30, 4), [29, 2]);
  assert.deepEqual(moveCell(3, 2, 'page-up', 30, 4), [0, 2]);
  assert.deepEqual(moveCell(10, 2, 'last', 30, 4), [29, 3]);
  assert.equal(gridMoveForKey('Home', true), 'first');
  assert.equal(gridMoveForKey('Home', false), 'row-start');
  assert.equal(gridMoveForKey('a', false), null);
});

test('today rolls over at the next local midnight', () => {
  const late = new Date(2026, 11, 31, 23, 59, 0);
  assert.equal(msUntilMidnight(late), 60_000);
  assert.ok(msUntilMidnight(new Date(2026, 0, 1, 0, 0, 0)) > 23 * 3600_000);
});
