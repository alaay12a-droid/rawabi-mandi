import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../../hooks/useColors';
import { Link, usePathname } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Slot } from 'expo-router';
import { Redirect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const pathname = usePathname();
  const { user } = useAuth();
  if (!user) return <Redirect href="/login" />;

  const tabs = [
    { name: 'index', path: '/', label: 'الطلبات', icon: 'receipt' as const },
    { name: 'previous', path: '/previous', label: 'السابقة', icon: 'history' as const },
    { name: 'settings', path: '/settings', label: 'الإعدادات', icon: 'settings' as const },
    { name: 'diagnostics', path: '/diagnostics', label: 'الطابعة', icon: 'print' as const },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === 'web' ? insets.top || 20 : insets.top || 16, backgroundColor: colors.primary }]}>
        <Text style={[styles.headerTitle, { color: colors.primaryForeground }]}>طابعة الطلبات المستقلة</Text>
      </View>
      
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
      
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom || 16 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {tabs.map((tab) => {
            const isActive = pathname === tab.path || (pathname === '' && tab.path === '/');
            return (
              <Link href={tab.path as any} key={tab.path} asChild>
                <Pressable style={styles.tabItem} testID={`tab-${tab.name}`}>
                  <View style={[styles.iconContainer, isActive && { backgroundColor: colors.primary }]}>
                    <MaterialIcons 
                      name={tab.icon} 
                      size={24} 
                      color={isActive ? colors.primaryForeground : colors.mutedForeground} 
                    />
                  </View>
                  <Text style={[styles.tabLabel, { color: isActive ? colors.primary : colors.mutedForeground }, isActive && styles.activeTabLabel]}>
                    {tab.label}
                  </Text>
                </Pressable>
              </Link>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
  },
  tabBar: {
    borderTopWidth: 1,
    minHeight: 80,
  },
  tabScroll: {
    paddingHorizontal: 8,
    alignItems: 'center',
    flexDirection: 'row-reverse',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 80,
  },
  iconContainer: {
    width: 48,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  activeTabLabel: {
    fontFamily: 'Inter_700Bold',
  },
});
