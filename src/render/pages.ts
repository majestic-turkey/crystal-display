import type { DitherMode } from './dither.js'
import { renderWeatherTemplate, renderCalendarTemplate, renderPhotoTemplate, renderNewsTemplate } from './template.js'

export type PageType = 'weather' | 'calendar' | 'photo' | 'news'

export const PAGE_TYPES: PageType[] = ['weather', 'calendar', 'photo', 'news']

export function isPageType(value: string): value is PageType {
  return (PAGE_TYPES as string[]).includes(value)
}

export function randomPage(): PageType {
  return PAGE_TYPES[Math.floor(Math.random() * PAGE_TYPES.length)]!
}

// Threshold keeps text and rules crisp; only photographic content wants error diffusion.
export function ditherModeFor(page: PageType): DitherMode {
  return page === 'photo' ? 'dither' : 'threshold'
}

/**
 * Renders one page's HTML. `baseUrl` is left undefined for captures and the
 * scheduled job so the templates fall back to the loopback BASE_URL, which is
 * what the screenshot browser should load assets over.
 */
export async function renderPageHtml(page: PageType, baseUrl?: string): Promise<string> {
  if (page === 'weather') {
    const { getWeatherData } = await import('../adapters/weather.js')
    return renderWeatherTemplate(await getWeatherData(), baseUrl)
  }
  if (page === 'calendar') {
    const { getCalendarData } = await import('../adapters/calendar.js')
    return renderCalendarTemplate(await getCalendarData(), baseUrl)
  }
  if (page === 'news') {
    const { getNewsData } = await import('../adapters/news.js')
    return renderNewsTemplate(await getNewsData(), baseUrl)
  }
  const { getPhotoData } = await import('../adapters/photos.js')
  return renderPhotoTemplate(await getPhotoData(), baseUrl)
}
