// app-mobile/src/storage/kv.ts
import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'

// expo-secure-store has no web implementation. This shim falls back to
// localStorage on web so the app is previewable in a browser; native
// builds (iOS/Android) always use the real SecureStore.
export async function getItemAsync(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
  }
  return SecureStore.getItemAsync(key)
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value)
    return
  }
  await SecureStore.setItemAsync(key, value)
}

export async function deleteItemAsync(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key)
    return
  }
  await SecureStore.deleteItemAsync(key)
}
