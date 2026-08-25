import { OAuth2Client } from 'google-auth-library'

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

export type GoogleProfile = { email: string; name: string }

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile | null> {
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID })
    const payload = ticket.getPayload()
    if (!payload?.email || !payload.email_verified) return null
    return { email: payload.email, name: payload.name ?? payload.email.split('@')[0] }
  } catch {
    return null
  }
}
