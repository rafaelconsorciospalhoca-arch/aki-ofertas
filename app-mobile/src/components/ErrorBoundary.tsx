import { Component, type ReactNode } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native'
import { colors } from '@/theme/colors'

type Props = { children: ReactNode }
type State = { error: Error | null }

// A screen that throws during render otherwise shows nothing (blank white,
// sometimes flickering as the navigator retries the transition) with no way
// to know why — this catches that and shows the actual error instead, so a
// crash on a real device is diagnosable from a screenshot.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('ErrorBoundary caught', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>Algo deu errado</Text>
          <Text style={styles.message}>{this.state.error.message}</Text>
          {!!this.state.error.stack && <Text style={styles.stack}>{this.state.error.stack}</Text>}
          <Pressable style={styles.button} onPress={() => this.setState({ error: null })}>
            <Text style={styles.buttonText}>Tentar de novo</Text>
          </Pressable>
        </ScrollView>
      )
    }
    return this.props.children
  }
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: colors.white, padding: 24, paddingTop: 64, gap: 12 },
  title: { fontSize: 18, fontWeight: '800', color: colors.neutral900 },
  message: { fontSize: 14, color: colors.red, fontWeight: '600' },
  stack: { fontSize: 11, color: colors.neutral500 },
  button: { backgroundColor: colors.green, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  buttonText: { color: colors.white, fontWeight: '700' },
})
