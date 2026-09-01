import { chromium, type Browser } from 'playwright'

let browserPromise: Promise<Browser> | null = null

export async function getBrowser(): Promise<Browser> {
  if (browserPromise) return browserPromise

  browserPromise = chromium
    .launch({
      channel: 'chromium-headless-shell',
      args: [
        '--no-sandbox',
        '--disable-lcd-text',
        '--force-color-profile=srgb',
      ],
  }).then(browser => {
    browser.on('disconnected', () => { browserPromise = null })
    return browser
  }).catch(err => {
    browserPromise = null
    throw err
  })

  return browserPromise
}

export async function closeBrowser(): Promise<void> {
  const pending = browserPromise
  browserPromise = null
  if (!pending) return
  try {
    await (await pending).close()
  } catch (err) {
    // ignore errors, since the browser may have already been closed
  }
}