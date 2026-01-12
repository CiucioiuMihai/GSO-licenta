import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';

interface NavbarProps {
  activeTab: string;
  onTabPress: (tab: string) => void;
  user: any;
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
    
    if (tabId === 'create') {
      Alert.alert('Coming Soon', 'Create post feature in development!');
      return;
    }
    
    if (tabId === 'achievements' || tabId === 'profile') {
      Alert.alert('Coming Soon', `${tabId.charAt(0).toUpperCase() + tabId.slice(1)} feature in development!`);
      return;
    }
    
    onTabPress(tabId);
  };

  const isWeb = Platform.OS === 'web';

  return (
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
              activeTab === item.id && styles.navItemActive,
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
            {(isWeb || activeTab === item.id) && (
              <Text style={[
                styles.navLabel,
                activeTab === item.id && styles.navLabelActive,
                isWeb && styles.navLabelWeb,
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
          <Text style={styles.webUserLevel}>Level 1</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  navbar: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderColor: 'rgba(0, 0, 0, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
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
    borderBottomWidth: 1,
    zIndex: 1000,
  },
  navbarMobile: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    paddingBottom: 10,
    borderTopWidth: 1,
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
    color: '#666',
    fontWeight: '500',
  },
  webRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  webUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  webUserLevel: {
    fontSize: 14,
    color: '#667eea',
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
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  navItem: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    minWidth: 60,
  },
  navItemWeb: {
    marginHorizontal: 10,
    paddingHorizontal: 16,
  },
  navItemActive: {
    backgroundColor: '#667eea',
  },
  navIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  navIconWeb: {
    fontSize: 18,
    marginBottom: 4,
  },
  navIconActive: {
    // Icon remains same color
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  navLabelWeb: {
    fontSize: 13,
    color: '#333',
  },
  navLabelActive: {
    color: '#fff',
  },
});

export default Navbar;