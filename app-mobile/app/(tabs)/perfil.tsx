import { useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { colors } from '@/theme/colors'
import { useAuth } from '@/auth/AuthContext'
import { useProfile, useUpdateProfile } from '@/api/hooks/useProfile'
import { ApiError } from '@/api/client'

export default function PerfilScreen() {
  const { token, logout } = useAuth()
  const profile = useProfile()
  const updateProfile = useUpdateProfile()

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)

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

  function startEditing() {
    setName(profile.data!.name)
    setPhone(profile.data!.phone ?? '')
    setError(null)
    setEditing(true)
  }

  async function handleSave() {
    setError(null)
    try {
      await updateProfile.mutateAsync({ name, phone })
      setEditing(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar. Tente novamente.')
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Meu perfil</Text>
        {!editing && (
          <Pressable onPress={startEditing}>
            <Text style={styles.editText}>Editar</Text>
          </Pressable>
        )}
      </View>

      {editing ? (
        <>
          <View style={styles.field}>
            <Text style={styles.label}>Nome</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Telefone</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.editActions}>
            <Pressable style={styles.button} onPress={handleSave} disabled={updateProfile.isPending}>
              {updateProfile.isPending ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>Salvar</Text>
              )}
            </Pressable>
            <Pressable onPress={() => setEditing(false)}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <View style={styles.field}>
            <Text style={styles.label}>Nome</Text>
            <Text style={styles.value}>{profile.data.name}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Telefone</Text>
            <Text style={styles.value}>{profile.data.phone ?? 'Não informado'}</Text>
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
        </>
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
  button: { backgroundColor: colors.green, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32, alignItems: 'center' },
  buttonText: { color: colors.white, fontWeight: '700' },
  container: { flex: 1, padding: 24, gap: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '800', color: colors.neutral900 },
  editText: { color: colors.green, fontWeight: '700', fontSize: 14 },
  field: { borderBottomWidth: 1, borderBottomColor: colors.neutral200, paddingBottom: 12 },
  label: { fontSize: 12, color: colors.neutral500 },
  value: { fontSize: 15, color: colors.neutral900, marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral200,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    marginTop: 4,
  },
  editActions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
  cancelText: { color: colors.neutral500, fontWeight: '600' },
  error: { color: colors.red, fontSize: 13 },
  linkRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.neutral200 },
  linkText: { fontSize: 15, color: colors.neutral900, fontWeight: '600' },
  logoutButton: { marginTop: 24, alignItems: 'center' },
  logoutText: { color: colors.red, fontWeight: '700' },
})
