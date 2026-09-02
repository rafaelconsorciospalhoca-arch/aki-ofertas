import { OAuth2Client } from 'google-auth-library'

const client = new OAuth2Client()

// O app mobile (iOS) autentica com um client OAuth diferente do usado pelo
// site — o token verificador precisa aceitar qualquer um dos dois como
// audience válido.
const allowedAudiences = [process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_IOS_CLIENT_ID].filter(
  (id): id is string => Boolean(id),
)

export type GoogleProfile = { email: string; name: string }

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile | null> {
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: allowedAudiences })
    const payload = ticket.getPayload()
    if (!payload?.email || !payload.email_verified) return null
    return { email: payload.email, name: payload.name ?? payload.email.split('@')[0] }
  } catch {
    return null
  }
}
