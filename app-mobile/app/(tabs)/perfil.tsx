import { useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { Pencil, Phone, MapPin, Mail, Package, LogOut, ChevronRight, Check, X } from 'lucide-react-native'
import { colors } from '@/theme/colors'
import { useAuth } from '@/auth/AuthContext'
import { useProfile, useUpdateProfile } from '@/api/hooks/useProfile'
import { ApiError } from '@/api/client'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(profile.data.name)}</Text>
        </View>
        <Text style={styles.name}>{profile.data.name}</Text>
        <Text style={styles.email}>{profile.data.email}</Text>
        {!editing && (
          <Pressable style={styles.editButton} onPress={startEditing}>
            <Pencil size={14} color={colors.white} />
            <Text style={styles.editButtonText}>Editar perfil</Text>
          </Pressable>
        )}
      </View>

      {editing ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Editar dados</Text>
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
            <Pressable style={styles.saveButton} onPress={handleSave} disabled={updateProfile.isPending}>
              {updateProfile.isPending ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Check size={16} color={colors.white} />
                  <Text style={styles.buttonText}>Salvar</Text>
                </>
              )}
            </Pressable>
            <Pressable style={styles.cancelButton} onPress={() => setEditing(false)}>
              <X size={16} color={colors.neutral500} />
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Meus dados</Text>
          <View style={styles.infoRow}>
            <Phone size={18} color={colors.neutral400} />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Telefone</Text>
              <Text style={styles.infoValue}>{profile.data.phone ?? 'Não informado'}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Mail size={18} color={colors.neutral400} />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>E-mail</Text>
              <Text style={styles.infoValue}>{profile.data.email}</Text>
            </View>
          </View>
          {profile.data.city && (
            <View style={[styles.infoRow, styles.infoRowLast]}>
              <MapPin size={18} color={colors.neutral400} />
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Cidade</Text>
                <Text style={styles.infoValue}>{profile.data.city}</Text>
              </View>
            </View>
          )}
        </View>
      )}

      <View style={styles.card}>
        <Pressable style={styles.menuRow} onPress={() => router.push('/pedidos')}>
          <Package size={18} color={colors.neutral900} />
          <Text style={styles.menuText}>Meus pedidos</Text>
          <ChevronRight size={18} color={colors.neutral400} />
        </Pressable>
      </View>

      <Pressable style={styles.logoutButton} onPress={() => logout()}>
        <LogOut size={16} color={colors.red} />
        <Text style={styles.logoutText}>Sair da conta</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.neutral900 },
  button: { backgroundColor: colors.green, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32, alignItems: 'center' },
  buttonText: { color: colors.white, fontWeight: '700' },
  container: { flex: 1, backgroundColor: colors.neutral100 },
  content: { paddingBottom: 32 },
  header: {
    backgroundColor: colors.navy,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 24,
    gap: 4,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarText: { fontSize: 26, fontWeight: '800', color: colors.white },
  name: { fontSize: 18, fontWeight: '800', color: colors.white },
  email: { fontSize: 13, color: colors.neutral200 },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 12,
  },
  editButtonText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardTitle: { fontSize: 13, fontWeight: '800', color: colors.neutral400, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral100,
  },
  infoRowLast: { borderBottomWidth: 0 },
  infoText: { flex: 1 },
  infoLabel: { fontSize: 11, color: colors.neutral400 },
  infoValue: { fontSize: 14, fontWeight: '600', color: colors.neutral900, marginTop: 1 },
  field: { marginBottom: 12 },
  label: { fontSize: 12, color: colors.neutral500, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral200,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  editActions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.green,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  cancelButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 12 },
  cancelText: { color: colors.neutral500, fontWeight: '600' },
  error: { color: colors.red, fontSize: 13, marginBottom: 8 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuText: { flex: 1, fontSize: 15, color: colors.neutral900, fontWeight: '600' },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    marginHorizontal: 16,
    paddingVertical: 12,
  },
  logoutText: { color: colors.red, fontWeight: '700' },
})
