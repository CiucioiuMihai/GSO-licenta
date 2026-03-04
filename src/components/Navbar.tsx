import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { User } from '@/types';
import { calculateLevel } from '@/utils/gamification';

interface NavbarProps {
  activeTab: string;
  onTabPress: (tab: string) => void;
  user: User | null;
}

const Navbar: React.FC<NavbarProps> = ({ activeTab, onTabPress, user }) => {
  const navItems = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'explore', label: 'Messages', icon: '💬' },
    { id: 'create', label: 'Create', icon: '➕' },
    { id: 'achievements', label: 'Achievements', icon: '🏆' },
    { id: 'profile', label: 'Profile', icon: '👤' },
  ];

  const handleTabPress = (tabId: string) => {
    if (tabId === activeTab) return;
    onTabPress(tabId);
  };

  const isWeb = Platform.OS === 'web';

  return (
    <>
      {/* Black background below navbar for mobile */}
      {!isWeb && <View style={styles.navbarBackground} />}
      
      <View style={[styles.navbar, isWeb ? styles.navbarWeb : styles.navbarMobile]}>
        {/* Web: Show app info on left, nav in center, user info on right */}
        {isWeb && (
        <View style={styles.webLeft}>
          <Text style={styles.webLogo}>🎮 GSO</Text>
          <Text style={styles.webSubtitle}>Gamified Social</Text>
        </View>
      )}

      <View style={[styles.navItems, isWeb ? styles.navItemsWeb : styles.navItemsMobile]}>
        {navItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.navItem,
              isWeb && styles.navItemWeb,
            ]}
            onPress={() => handleTabPress(item.id)}
          >
            <Text style={[
              styles.navIcon,
              activeTab === item.id && styles.navIconActive,
              isWeb && styles.navIconWeb,
            ]}>
              {item.icon}
            </Text>
            {isWeb && (
              <Text style={[
                styles.navLabel,
                activeTab === item.id && styles.navLabelActive,
                styles.navLabelWeb,
              ]}>
                {item.label}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Web: User info on right */}
      {isWeb && (
        <View style={styles.webRight}>
          <Text style={styles.webUserName}>
            {user?.displayName || 'User'}
          </Text>
          <Text style={styles.webUserLevel}>
            Level {user?.level || calculateLevel(user?.xp || 0)}
          </Text>
        </View>
      )}
    </View>
    </>
  );
};

const styles = StyleSheet.create({
  navbar: {
    backgroundColor: '#000',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  navbarBackground: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: '#000',
    zIndex: 999,
  },
  navbarWeb: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderBottomWidth: Platform.OS === 'android' ? 0 : 1,
    zIndex: 1000,
  },
  navbarMobile: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    height: 50,
    paddingBottom: 0,
    borderTopWidth: 0,
    zIndex: 1000,
  },
  webLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  webLogo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#667eea',
    marginRight: 8,
  },
  webSubtitle: {
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
  },
  webRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  webUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  webUserLevel: {
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
  },
  navItems: {
    flexDirection: 'row',
  },
  navItemsWeb: {
    flex: 2,
    justifyContent: 'center',
  },
  navItemsMobile: {
    flex: 1,
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 0,
    paddingHorizontal: 0,
    flex: 1,
  },
  navItemWeb: {
    marginHorizontal: 10,
    paddingHorizontal: 16,
  },
  navItemActive: {
    // No background for Instagram style
  },
  navIcon: {
    fontSize: 24,
    color: '#fff',
    opacity: 0.6,
  },
  navIconWeb: {
    fontSize: 18,
    marginBottom: 4,
    color: '#fff',
    opacity: 0.8,
  },
  navIconActive: {
    opacity: 1,
  },
  navLabel: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '500',
  },
  navLabelWeb: {
    marginTop: 2,
  },
  navLabelActive: {
    fontWeight: '700',
  },
});

export default Navbar;