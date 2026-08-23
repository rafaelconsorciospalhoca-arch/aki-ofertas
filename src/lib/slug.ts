export function slugify(text: string): string {
  const withoutDiacritics = Array.from(text.normalize('NFD'))
    .filter((char) => {
      const codePoint = char.codePointAt(0) ?? 0
      return codePoint < 0x0300 || codePoint > 0x036f
    })
    .join('')

  return withoutDiacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function randomSlugSuffix(): string {
  return Math.random().toString(36).slice(2, 7)
}
