import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { msUntilNextRefresh, isScoresWindow } from '../src/render/job.js'

const MINUTE = 60_000
const REFRESH_INTERVAL_MINUTES = 10 // matches the device's 600s sleep

/** Local time, since the scheduler works off the process timezone. */
function at(hour: number, minute: number, second = 0, ms = 0): Date {
    return new Date(2026, 8, 7, hour, minute, second, ms)
}

describe('msUntilNextRefresh', () => {
    test('waits a full interval when starting on a minute boundary', () => {
        assert.equal(msUntilNextRefresh(at(3, 20)), REFRESH_INTERVAL_MINUTES * MINUTE)
        assert.equal(msUntilNextRefresh(at(3, 0)), REFRESH_INTERVAL_MINUTES * MINUTE)
    })

    test('trims the partial minute so renders land on :00 seconds', () => {
        assert.equal(msUntilNextRefresh(at(3, 20, 30)), 9 * MINUTE + 30_000)
        assert.equal(msUntilNextRefresh(at(3, 20, 59, 999)), 9 * MINUTE + 1)
    })

    test('never returns zero or negative, so the timer cannot spin', () => {
        for (let minute = 0; minute < 60; minute++) {
            for (const [second, ms] of [[0, 0], [30, 0], [59, 999]] as const) {
                const delay = msUntilNextRefresh(at(4, minute, second, ms))
                assert.ok(delay > (REFRESH_INTERVAL_MINUTES - 1) * MINUTE, `delay at 4:${minute}:${second}.${ms} must be over ${REFRESH_INTERVAL_MINUTES - 1} minutes`)
                assert.ok(delay <= REFRESH_INTERVAL_MINUTES * MINUTE, `delay at 4:${minute}:${second}.${ms} must be within ${REFRESH_INTERVAL_MINUTES} minutes`)
            }
        }
    })

    test('always lands exactly on a whole minute', () => {
        for (const start of [at(0, 0), at(3, 20, 15, 250), at(23, 55, 5), at(12, 50, 0, 1)]) {
            const landing = new Date(start.getTime() + msUntilNextRefresh(start))
            const expectedMinute = (start.getMinutes() + REFRESH_INTERVAL_MINUTES) % 60
            assert.equal(landing.getMinutes(), expectedMinute, `from ${start.toISOString()}`)
            assert.equal(landing.getSeconds(), 0)
            assert.equal(landing.getMilliseconds(), 0)
        }
    })

    test('rolls into the next hour', () => {
        const start = at(3, 55)
        const landing = new Date(start.getTime() + msUntilNextRefresh(start))
        assert.equal(landing.getHours(), 4)
        assert.equal(landing.getMinutes(), 5)
    })

    test('crosses midnight without going backwards', () => {
        const start = at(23, 55)
        const delay = msUntilNextRefresh(start)
        const landing = new Date(start.getTime() + delay)
        assert.equal(delay, REFRESH_INTERVAL_MINUTES * MINUTE)
        assert.equal(landing.getHours(), 0)
        assert.equal(landing.getMinutes(), 5)
        assert.equal(landing.getDate(), 8, 'rolls to the next day')
    })
})

// UTC instants — Nov 14 2026 is a Saturday in EST (UTC-5).
describe('isScoresWindow', () => {
    test('opens at noon and closes at midnight Eastern on Saturday, across DST', () => {
        assert.equal(isScoresWindow(new Date('2026-11-14T16:59:59Z')), false, '11:59am EST')
        assert.equal(isScoresWindow(new Date('2026-11-14T17:00:00Z')), true,  'noon EST')
        assert.equal(isScoresWindow(new Date('2026-11-15T04:59:59Z')), true,  '11:59pm EST')
        assert.equal(isScoresWindow(new Date('2026-11-15T05:00:00Z')), false, 'midnight EST (Sunday)')
        // EDT (UTC-4): Oct 17 2026 is a Saturday
        assert.equal(isScoresWindow(new Date('2026-10-17T15:59:59Z')), false, '11:59am EDT')
        assert.equal(isScoresWindow(new Date('2026-10-17T16:00:00Z')), true,  'noon EDT')
        assert.equal(isScoresWindow(new Date('2026-10-18T03:59:59Z')), true,  '11:59pm EDT')
        assert.equal(isScoresWindow(new Date('2026-10-18T04:00:00Z')), false, 'midnight EDT (Sunday)')
    })

    test('stays shut on other days at the same hour', () => {
        assert.equal(isScoresWindow(new Date('2026-11-13T17:00:00Z')), false, 'Friday noon EST')
        assert.equal(isScoresWindow(new Date('2026-11-15T17:00:00Z')), false, 'Sunday noon EST')
    })

    test('covers the full Saturday night including 11pm games', () => {
        assert.equal(isScoresWindow(new Date('2026-11-15T04:00:00Z')), true, '11pm EST — night game still live')
        assert.equal(isScoresWindow(new Date('2026-11-15T04:30:00Z')), true, '11:30pm EST')
        assert.equal(isScoresWindow(new Date('2026-11-15T04:59:59Z')), true, '11:59pm EST')
    })
})
