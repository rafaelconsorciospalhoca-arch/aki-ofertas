import { Tabs } from 'expo-router'
import { colors } from '@/theme/colors'
import { TabIcons } from '@/theme/icons'

const ICON_SIZE = 24

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.neutral400,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: {
          height: 64,
          paddingTop: 8,
          paddingBottom: 10,
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
