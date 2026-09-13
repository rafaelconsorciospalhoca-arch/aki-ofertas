import { optimizedImageUrl } from '../optimizedImageUrl'

describe('optimizedImageUrl', () => {
  it('returns the URL unchanged, with no headers, for a non-blob host', () => {
    const result = optimizedImageUrl('https://example.com/photo.png', 150)

    expect(result).toEqual({ uri: 'https://example.com/photo.png' })
  })

  it('routes a blob URL through the site image optimizer with the requested size', () => {
    const result = optimizedImageUrl(
      'https://abc123.public.blob.vercel-storage.com/foo.png',
      400,
    )

    expect(result.uri).toBe(
      'https://akiofertas.com.br/_next/image?url=https%3A%2F%2Fabc123.public.blob.vercel-storage.com%2Ffoo.png&w=400&q=75',
    )
  })

  it('requests webp explicitly so the optimizer does not fall back to the larger original format', () => {
    const result = optimizedImageUrl(
      'https://abc123.public.blob.vercel-storage.com/foo.png',
      400,
    )

    expect(result.headers).toEqual({ Accept: 'image/webp' })
  })

  it('accepts a custom quality', () => {
    const result = optimizedImageUrl(
      'https://abc123.public.blob.vercel-storage.com/foo.png',
      150,
      50,
    )

    expect(result.uri).toContain('q=50')
  })
})
