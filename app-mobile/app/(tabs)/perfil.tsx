import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { colors } from '@/theme/colors'
import { useAuth } from '@/auth/AuthContext'
import { useProfile } from '@/api/hooks/useProfile'

export default function PerfilScreen() {
  const { token, logout } = useAuth()
  const profile = useProfile()

  if (!token) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Entre para ver seu perfil</Text>
        <Pressable style={styles.button} onPress={() => router.push('/entrar')}>
          <Text style={styles.buttonText}>Entrar</Text>
        </Pressable>
      </View>
    )
  }

  if (profile.isLoading || !profile.data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.green} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Meu perfil</Text>
      <View style={styles.field}>
        <Text style={styles.label}>Nome</Text>
        <Text style={styles.value}>{profile.data.name}</Text>
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>E-mail</Text>
        <Text style={styles.value}>{profile.data.email}</Text>
      </View>
      {profile.data.city && (
        <View style={styles.field}>
          <Text style={styles.label}>Cidade</Text>
          <Text style={styles.value}>{profile.data.city}</Text>
        </View>
      )}
      <Pressable style={styles.linkRow} onPress={() => router.push('/pedidos')}>
        <Text style={styles.linkText}>Meus pedidos</Text>
      </Pressable>
      <Pressable style={styles.logoutButton} onPress={() => logout()}>
        <Text style={styles.logoutText}>Sair</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.neutral900 },
  button: { backgroundColor: colors.green, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32 },
  buttonText: { color: colors.white, fontWeight: '700' },
  container: { flex: 1, padding: 24, gap: 16 },
  title: { fontSize: 20, fontWeight: '800', color: colors.neutral900, marginBottom: 8 },
  field: { borderBottomWidth: 1, borderBottomColor: colors.neutral200, paddingBottom: 12 },
  label: { fontSize: 12, color: colors.neutral500 },
  value: { fontSize: 15, color: colors.neutral900, marginTop: 2 },
  linkRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.neutral200 },
  linkText: { fontSize: 15, color: colors.neutral900, fontWeight: '600' },
  logoutButton: { marginTop: 24, alignItems: 'center' },
  logoutText: { color: colors.red, fontWeight: '700' },
})
