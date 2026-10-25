import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { parsePsalm } from '../src/adapters/psalm.js'
import { isPsalmWindow, isScoresWindow } from '../src/render/job.js'

// Trimmed from the USCCB readings feed, which is HTML inside the RSS description.
const SUNDAY_READINGS = `
<h4>Reading 1  <a href="https://bible.usccb.org/bible/exodus/22?20 ">Exodus 22:20-26</a></h4>
<div class="poetry"><p>Thus says the LORD:<br>"You shall not molest or oppress an alien,</p></div>
<h4>Responsorial Psalm  <a href="https://bible.usccb.org/bible/psalms/18?2 ">Psalm 18:2-3, 3-4, 47, 51</a></h4>
<div class="poetry">
  <p>R. (2) <strong>I love you, Lord, my strength.</strong><br>I love you, O LORD, my strength,<br>O LORD, my rock, my fortress, my deliverer.<br>R. <strong>I love you, Lord, my strength.</strong><br>My God, my rock of refuge,<br>my shield, the horn of my salvation, my stronghold!<br>R. <strong>I love you, Lord, my strength.</strong><br>&nbsp;</p>
</div>
<h4>Reading 2  <a href="https://bible.usccb.org/bible/1thessalonians/1?5 ">1 Thessalonians 1:5c-10</a></h4>
<div class="poetry"><p>Brothers and sisters:</p></div>`

describe('parsePsalm', () => {
    test('pulls the citation, refrain, and stanzas out of the day\'s readings', () => {
        const psalm = parsePsalm('Thirtieth Sunday in Ordinary Time', SUNDAY_READINGS)
        assert.deepEqual(psalm, {
            day: 'Thirtieth Sunday in Ordinary Time',
            citation: 'Psalm 18:2-3, 3-4, 47, 51',
            response: 'I love you, Lord, my strength.',
            stanzas: [
                ['I love you, O LORD, my strength,', 'O LORD, my rock, my fortress, my deliverer.'],
                ['My God, my rock of refuge,', 'my shield, the horn of my salvation, my stronghold!'],
            ],
        })
    })

    // Regression: some days pad the refrain marker with &nbsp; and close stanzas with
    // </p>, which the first version of the parser rejected outright.
    test('handles &nbsp; padding and paragraph-delimited stanzas', () => {
        const html = `<h4>Responsorial Psalm <a href="x">Psalm 24:1-2, 3-4ab, 5-6</a></h4>
<div class="poetry"><p>R.&nbsp;&nbsp; &nbsp;(see 6)<strong> Lord, this is the people that longs to see your face.</strong><br>The LORD’s are the earth and its fullness;<br>the world and those who dwell in it.<br>R.&nbsp;&nbsp; &nbsp;<strong>Lord, this is the people that longs to see your face.</strong></p><p>&nbsp;</p></div>`
        const psalm = parsePsalm('Friday', html)
        assert.equal(psalm.response, 'Lord, this is the people that longs to see your face.')
        assert.deepEqual(psalm.stanzas, [['The LORD’s are the earth and its fullness;', 'the world and those who dwell in it.']])
    })

    test('drops the "or:" line that introduces an alternate refrain', () => {
        const html = `<h4>Responsorial Psalm <a href="x">Psalm 118</a></h4>
<div class="poetry"><p>R. (24) <strong>This is the day the Lord has made; let us rejoice and be glad.</strong><br>or:<br>R. <strong>Alleluia.</strong><br>Give thanks to the LORD, for he is good,<br>R. <strong>Alleluia.</strong></p></div>`
        const psalm = parsePsalm('Easter Sunday', html)
        assert.equal(psalm.response, 'This is the day the Lord has made; let us rejoice and be glad.')
        assert.deepEqual(psalm.stanzas, [['Give thanks to the LORD, for he is good,']])
    })

    test('throws rather than returning a half-parsed psalm', () => {
        assert.throws(() => parsePsalm('Sunday', '<h4>Reading 1</h4><div class="poetry"><p>text</p></div>'))
        const noRefrain = '<h4>Responsorial Psalm <a href="x">Psalm 1</a></h4><div class="poetry"><p>Just verses<br>and more</p></div>'
        assert.throws(() => parsePsalm('Sunday', noRefrain))
    })
})

// UTC instants, since the container runs in UTC and the windows are Eastern.
// Oct 25 2026 is EDT (UTC-4); Nov 8 2026 is after the change to EST (UTC-5).
describe('isPsalmWindow', () => {
    test('opens at 2am and closes at noon Eastern on Sunday, across DST', () => {
        assert.equal(isPsalmWindow(new Date('2026-10-25T05:59:59Z')), false, '1:59am EDT')
        assert.equal(isPsalmWindow(new Date('2026-10-25T06:00:00Z')), true, '2:00am EDT')
        assert.equal(isPsalmWindow(new Date('2026-10-25T15:59:59Z')), true, '11:59am EDT')
        assert.equal(isPsalmWindow(new Date('2026-10-25T16:00:00Z')), false, 'noon EDT')
        assert.equal(isPsalmWindow(new Date('2026-11-08T06:30:00Z')), false, '1:30am EST')
        assert.equal(isPsalmWindow(new Date('2026-11-08T07:00:00Z')), true, '2:00am EST')
        assert.equal(isPsalmWindow(new Date('2026-11-08T17:00:00Z')), false, 'noon EST')
    })

    test('stays shut on other days at the same hour', () => {
        assert.equal(isPsalmWindow(new Date('2026-10-24T14:00:00Z')), false, 'Saturday 10am')
        assert.equal(isPsalmWindow(new Date('2026-10-26T14:00:00Z')), false, 'Monday 10am')
    })

    test('never overlaps the Saturday scores window', () => {
        for (let hour = 0; hour < 24 * 7; hour++) {
            const instant = new Date(Date.UTC(2026, 9, 19) + hour * 3_600_000)
            assert.ok(!(isPsalmWindow(instant) && isScoresWindow(instant)), instant.toISOString())
        }
    })
})
