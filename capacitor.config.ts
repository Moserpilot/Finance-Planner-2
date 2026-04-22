import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.networth.financeplanner',
  appName: 'NetWorth',
  webDir: 'out',
  server: {
    // Makes Android use https:// scheme so localStorage & APIs behave correctly
    androidScheme: 'https',
  },
  ios: {
    // Respect the iOS safe-area (notch / home indicator)
    contentInset: 'automatic',
  },
};

export default config;
