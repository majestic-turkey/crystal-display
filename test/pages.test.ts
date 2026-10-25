import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { PAGE_TYPES, ALL_PAGES, isPageType, ditherModeFor, renderPageHtml, randomPage } from '../src/render/pages.js'

// Each page's <title>, so a template that quietly falls through is caught.
const EXPECTED_TITLE: Record<string, string> = {
    weather: 'E-Ink Weather',
    calendar: 'E-Ink Calendar',
    photo: 'E-Ink Photo',
    news: 'E-Ink News',
    scores: 'E-Ink Scores',
    psalm: 'E-Ink Psalm',
}

describe('page registry', () => {
    test('covers every page the templates provide', () => {
        assert.deepEqual([...ALL_PAGES].sort(), Object.keys(EXPECTED_TITLE).sort())
    })

    test('keeps the scheduled pages out of the rotation', () => {
        for (const page of ['scores', 'psalm'] as const) {
            assert.ok(!PAGE_TYPES.includes(page), `${page} only shows in its own window`)
            assert.ok(isPageType(page), `${page} must still pass isPageType, or a restart would discard its render.json`)
        }
    })

    test('recognises known pages and rejects the rest', () => {
        for (const page of ALL_PAGES) assert.ok(isPageType(page), page)
        for (const bad of ['sports', 'Weather', '', 'photo ', '__proto__']) {
            assert.equal(isPageType(bad), false, `must reject ${JSON.stringify(bad)}`)
        }
    })

    test('dithers photographs and thresholds everything else', () => {
        assert.equal(ditherModeFor('photo'), 'dither')
        for (const page of ALL_PAGES.filter(p => p !== 'photo')) {
            assert.equal(ditherModeFor(page), 'threshold', page)
        }
    })

    test('randomPage only ever returns a real page', () => {
        for (let i = 0; i < 200; i++) assert.ok(PAGE_TYPES.includes(randomPage()))
    })
})

describe('renderPageHtml', () => {
    // Regression: a merge once dropped news from the render path, so it silently
    // fell through and served the photo template instead.
    for (const page of ALL_PAGES) {
        test(`renders the ${page} template`, async () => {
            const html = await renderPageHtml(page)
            assert.match(html, /^<!DOCTYPE html>/)
            assert.ok(html.includes(`<title>${EXPECTED_TITLE[page]}</title>`), `wrong template for ${page}`)
        })
    }

    test('defaults the base href to the configured BASE_URL', async () => {
        const html = await renderPageHtml('weather')
        assert.match(html, /<base href="http:\/\/127\.0\.0\.1:7000\/">/)
    })

    test('honours an explicit base URL so remote previews load their assets', async () => {
        const html = await renderPageHtml('weather', 'https://display.example.com')
        assert.match(html, /<base href="https:\/\/display\.example\.com\/">/)
    })
})
