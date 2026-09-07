import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { msUntilNextRefresh } from '../src/render/job.js'

const MINUTE = 60_000
const REFRESH_MINUTE = 50 // renders land just before the device wakes on the hour

/** Local time, since the scheduler works off the process timezone. */
function at(hour: number, minute: number, second = 0, ms = 0): Date {
    return new Date(2026, 8, 7, hour, minute, second, ms)
}

describe('msUntilNextRefresh', () => {
    test('waits until :50 later in the same hour', () => {
        assert.equal(msUntilNextRefresh(at(3, 20)), 30 * MINUTE)
        assert.equal(msUntilNextRefresh(at(3, 49)), 1 * MINUTE)
    })

    test('rolls into the next hour once :50 has passed', () => {
        assert.equal(msUntilNextRefresh(at(3, 51)), 59 * MINUTE)
        assert.equal(msUntilNextRefresh(at(3, 59, 59)), 50 * MINUTE + 1_000)
    })

    test('never returns zero or negative, so the timer cannot spin', () => {
        // Exactly on the boundary must schedule a full hour out, not fire immediately.
        assert.equal(msUntilNextRefresh(at(3, REFRESH_MINUTE)), 60 * MINUTE)
        for (let minute = 0; minute < 60; minute++) {
            for (const second of [0, 30, 59]) {
                const delay = msUntilNextRefresh(at(4, minute, second))
                assert.ok(delay > 0, `delay at 4:${minute}:${second} must be positive`)
                assert.ok(delay <= 60 * MINUTE, `delay at 4:${minute}:${second} must be within an hour`)
            }
        }
    })

    test('always lands exactly on :50:00.000', () => {
        for (const start of [at(0, 0), at(3, 20, 15, 250), at(23, 55, 5), at(12, 50, 0, 1)]) {
            const landing = new Date(start.getTime() + msUntilNextRefresh(start))
            assert.equal(landing.getMinutes(), REFRESH_MINUTE, `from ${start.toISOString()}`)
            assert.equal(landing.getSeconds(), 0)
            assert.equal(landing.getMilliseconds(), 0)
        }
    })

    test('crosses midnight without going backwards', () => {
        const start = at(23, 55)
        const delay = msUntilNextRefresh(start)
        const landing = new Date(start.getTime() + delay)
        assert.equal(delay, 55 * MINUTE)
        assert.equal(landing.getHours(), 0)
        assert.equal(landing.getMinutes(), REFRESH_MINUTE)
        assert.equal(landing.getDate(), 8, 'rolls to the next day')
    })
})
