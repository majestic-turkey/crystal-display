import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { msUntilNextRefresh } from '../src/render/job.js'

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
