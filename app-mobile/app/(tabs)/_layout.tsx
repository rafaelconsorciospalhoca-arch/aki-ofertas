import { Tabs } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '@/theme/colors'
import { TabIcons } from '@/theme/icons'

const ICON_SIZE = 24

export default function TabsLayout() {
  // Root cause of the label text looking "cut" (confirmed by inspecting the
  // live DOM): with height 64 / paddingTop 8 / paddingBottom 10, the content
  // area available for icon+label was only 46px (64-8-10), but the icon
  // (24px) plus the label's natural line height (~15px) plus their gap need
  // about 49px — 3px short. Flexbox's default flex-shrink then squeezed the
  // label's box down to ~7px, and `overflow: hidden` (from numberOfLines=1)
  // clipped the glyphs. Earlier attempts that added the same amount to both
  // `height` and `paddingBottom` never fixed this, because that cancels out
  // and leaves the content area exactly as tight as before — the content
  // area itself has to grow, not just the outer bar size.
  const insets = useSafeAreaInsets()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.neutral400,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: {
          height: 78 + insets.bottom,
          paddingTop: 8,
          paddingBottom: 14 + insets.bottom,
          borderTopWidth: 1,
          borderTopColor: colors.neutral200,
          backgroundColor: colors.white,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color }) => <TabIcons.House size={ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="empresas"
        options={{
          title: 'Empresas',
          tabBarIcon: ({ color }) => <TabIcons.Store size={ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cupons"
        options={{
          title: 'Cupons',
          tabBarIcon: ({ color }) => <TabIcons.Tag size={ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="favoritos"
        options={{
          title: 'Favoritos',
          tabBarIcon: ({ color }) => <TabIcons.Heart size={ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <TabIcons.User size={ICON_SIZE} color={color} />,
        }}
      />
    </Tabs>
  )
}
