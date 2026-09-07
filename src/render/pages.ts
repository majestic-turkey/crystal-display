import type { DitherMode } from './dither.js'
import { renderWeatherTemplate, renderCalendarTemplate, renderPhotoTemplate } from './template.js'

export type PageType = 'weather' | 'calendar' | 'photo'

export const PAGE_TYPES: PageType[] = ['weather', 'calendar', 'photo']

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

export async function renderPageHtml(page: PageType): Promise<string> {
  if (page === 'weather') {
    const { getWeatherData } = await import('../adapters/weather.js')
    return renderWeatherTemplate(await getWeatherData())
  }
  if (page === 'calendar') {
    const { getCalendarData } = await import('../adapters/calendar.js')
    return renderCalendarTemplate(await getCalendarData())
  }
  const { getPhotoData } = await import('../adapters/photos.js')
  return renderPhotoTemplate(await getPhotoData())
}
