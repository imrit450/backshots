#!/usr/bin/env bash
# Run once from the frontend/ directory after npm install:
#   bash scripts/setup-native.sh
set -e

echo "▶ Installing Capacitor native platforms..."
npx cap add ios
npx cap add android

echo "▶ Syncing web assets..."
npm run build:native

# ── iOS: inject required permission strings into Info.plist ──────────────────
PLIST="ios/App/App/Info.plist"
if [ -f "$PLIST" ]; then
  echo "▶ Patching iOS Info.plist with camera/mic permissions..."
  /usr/libexec/PlistBuddy -c "Add :NSCameraUsageDescription string 'Lumora uses your camera to capture event photos and videos.'" "$PLIST" 2>/dev/null || \
  /usr/libexec/PlistBuddy -c "Set :NSCameraUsageDescription 'Lumora uses your camera to capture event photos and videos.'" "$PLIST"

  /usr/libexec/PlistBuddy -c "Add :NSMicrophoneUsageDescription string 'Lumora uses your microphone to record event videos.'" "$PLIST" 2>/dev/null || \
  /usr/libexec/PlistBuddy -c "Set :NSMicrophoneUsageDescription 'Lumora uses your microphone to record event videos.'" "$PLIST"

  /usr/libexec/PlistBuddy -c "Add :NSPhotoLibraryAddUsageDescription string 'Lumora saves captured photos to your library.'" "$PLIST" 2>/dev/null || \
  /usr/libexec/PlistBuddy -c "Set :NSPhotoLibraryAddUsageDescription 'Lumora saves captured photos to your library.'" "$PLIST"

  echo "  ✓ Info.plist updated"
else
  echo "  ⚠ $PLIST not found — run this script after 'npx cap add ios'"
fi

# ── Android: reminder for manifest permissions (Capacitor adds them automatically) ─
echo ""
echo "✅ Native setup complete."
echo ""
echo "Next steps:"
echo "  iOS:     npm run open:ios     → build & run in Xcode"
echo "  Android: npm run open:android → build & run in Android Studio"
echo ""
echo "Set your real store URLs in src/guest/Camera.tsx:"
echo "  APP_STORE_URL  = your App Store link"
echo "  PLAY_STORE_URL = your Play Store link"
