import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendDeliveryZoneRequestEmail } from '@/lib/email'

const send = vi.fn()

vi.mock('resend', () => ({
  Resend: class {
    emails = { send }
  },
}))

describe('sendDeliveryZoneRequestEmail', () => {
  afterEach(() => vi.clearAllMocks())

  it('escapes HTML-significant characters from the neighborhood in the email body', async () => {
    send.mockResolvedValue({ error: null })

    await sendDeliveryZoneRequestEmail('dono@bigburger.com', {
      businessName: 'Big Burger',
      neighborhood: '<script>alert(1)</script>',
    })

    expect(send).toHaveBeenCalledTimes(1)
    const call = send.mock.calls[0][0]
    expect(call.html).not.toContain('<script>alert(1)</script>')
    expect(call.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('throws when Resend returns an API-level error', async () => {
    send.mockResolvedValue({ error: { message: 'boom' } })

    await expect(
      sendDeliveryZoneRequestEmail('dono@bigburger.com', {
        businessName: 'Big Burger',
        neighborhood: 'Centro',
      }),
    ).rejects.toThrow('boom')
  })
})
