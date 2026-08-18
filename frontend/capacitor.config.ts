import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'mu.zilware.lumora',
  appName: 'Lumora',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'always',
    // Transparent WebView so the native camera layer shows through on the camera screen
    backgroundColor: '00000000',
  },
  android: {
    backgroundColor: '#000000',
  },
  plugins: {
    CameraPreview: {
      // Lock the camera-preview layer to portrait
    },
  },
};

export default config;
