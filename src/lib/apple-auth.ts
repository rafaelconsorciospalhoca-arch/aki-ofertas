import { createRemoteJWKSet, jwtVerify } from 'jose'

const APPLE_ISSUER = 'https://appleid.apple.com'
const APPLE_JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'))

export type AppleProfile = { appleUserId: string; email: string | null }

// Apple only returns the user's name once, in the client-side
// AppleAuthentication.signInAsync() response — never in the identity token,
// and never again on later sign-ins. The identity token's `email` claim,
// though, is present on every sign-in as long as the user originally
// granted the email scope (even for a private-relay address), so email is
// what we use to find/create the account, matching the Google login path.
export async function verifyAppleIdentityToken(idToken: string): Promise<AppleProfile | null> {
  try {
    const { payload } = await jwtVerify(idToken, APPLE_JWKS, {
      issuer: APPLE_ISSUER,
      audience: process.env.APPLE_BUNDLE_ID,
    })
    if (typeof payload.sub !== 'string') return null
    const email = typeof payload.email === 'string' ? payload.email : null
    return { appleUserId: payload.sub, email }
  } catch {
    return null
  }
}
