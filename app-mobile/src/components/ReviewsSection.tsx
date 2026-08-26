import { useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { colors } from '@/theme/colors'
import { useAuth } from '@/auth/AuthContext'
import { useReviews, useSubmitReview } from '@/api/hooks/useReviews'
import { StarRating } from '@/components/StarRating'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

export function ReviewsSection({ slug }: { slug: string }) {
  const { token } = useAuth()
  const summary = useReviews(slug)
  const submitReview = useSubmitReview(slug)
  const [showForm, setShowForm] = useState(false)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (rating === 0) {
      setError('Escolha uma nota de 1 a 5.')
      return
    }
    setError(null)
    try {
      await submitReview.mutateAsync({ rating, comment: comment.trim() || undefined })
      setShowForm(false)
      setRating(0)
      setComment('')
    } catch {
      setError('Não foi possível enviar sua avaliação.')
    }
  }

  if (summary.isLoading) {
    return <ActivityIndicator color={colors.green} style={{ marginTop: 24 }} />
  }

  const average = summary.data?.average ?? 0
  const count = summary.data?.count ?? 0

  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        <StarRating rating={average} size={20} />
        <Text style={styles.summaryText}>
          {count > 0 ? `${average.toFixed(1)} (${count} avaliação${count === 1 ? '' : 'ões'})` : 'Sem avaliações ainda'}
        </Text>
      </View>

      {token ? (
        showForm ? (
          <View style={styles.form}>
            <StarRating rating={rating} size={26} onChange={setRating} />
            <TextInput
              style={styles.input}
              placeholder="Conte como foi sua experiência (opcional)"
              value={comment}
              onChangeText={setComment}
              multiline
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <View style={styles.formButtons}>
              <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={submitReview.isPending}>
                {submitReview.isPending ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.submitText}>Enviar avaliação</Text>
                )}
              </Pressable>
              <Pressable onPress={() => setShowForm(false)}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={styles.rateButton} onPress={() => setShowForm(true)}>
            <Text style={styles.rateButtonText}>Avaliar este estabelecimento</Text>
          </Pressable>
        )
      ) : (
        <Pressable onPress={() => router.push('/entrar')}>
          <Text style={styles.loginText}>Entre para avaliar este estabelecimento</Text>
        </Pressable>
      )}

      {(summary.data?.reviews.length ?? 0) === 0 ? (
        <Text style={styles.emptyText}>Nenhuma avaliação ainda.</Text>
      ) : (
        summary.data!.reviews.map((review) => (
          <View key={review.id} style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <Text style={styles.reviewerName}>{review.reviewerName}</Text>
              <Text style={styles.reviewDate}>{formatDate(review.createdAt)}</Text>
            </View>
            <StarRating rating={review.rating} size={14} />
            {review.comment && <Text style={styles.reviewComment}>{review.comment}</Text>}
          </View>
        ))
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { marginTop: 12, gap: 16 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryText: { fontSize: 13, color: colors.neutral500 },
  rateButton: {
    borderWidth: 1,
    borderColor: colors.neutral200,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  rateButtonText: { fontSize: 13, fontWeight: '700', color: colors.neutral900 },
  loginText: { fontSize: 13, color: colors.green, fontWeight: '600' },
  form: { gap: 10 },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral200,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  error: { color: colors.red, fontSize: 13 },
  formButtons: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  submitButton: { backgroundColor: colors.green, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20 },
  submitText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  cancelText: { color: colors.neutral500, fontSize: 13, fontWeight: '600' },
  emptyText: { fontSize: 13, color: colors.neutral400, textAlign: 'center', marginTop: 8 },
  reviewCard: { borderTopWidth: 1, borderTopColor: colors.neutral200, paddingTop: 12, gap: 6 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  reviewerName: { fontSize: 13, fontWeight: '700', color: colors.neutral900 },
  reviewDate: { fontSize: 12, color: colors.neutral400 },
  reviewComment: { fontSize: 13, color: colors.neutral500, lineHeight: 19 },
})
