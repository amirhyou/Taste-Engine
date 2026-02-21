# How to Run & Test Taste Engine Mobile MVP 📱

Follow these steps to launch the app on your phone or emulator.

## 1. Prerequisites
- **Node.js** installed on your machine.
- **Expo Go** app installed on your physical device (iOS/Android), or an emulator set up.

## 2. Setup
Navigate to the mobile app directory and ensure dependencies are ready:
```bash
cd examples/mobile-app
npm install
```

## 3. Run the App
Start the Expo development server:
```bash
npx expo start
```

## 4. Testing the Loop
1. **Scan the QR Code**: Use the Expo Go app (Android) or Camera app (iOS) to scan the QR code shown in your terminal.
2. **Connect Spotify**: Click the "Connect Spotify" button. It will open a browser for you to log in.
3. **Pick a Playlist**: Select one of your Spotify playlists from the list.
4. **Choose Top K**: Select 10, 20, 50, or 100.
5. **Vote**: 
   - Drag the slider **Left** for the Top item.
   - Drag the slider **Right** for the Bottom item.
   - Note the **Haptic Feedback** when you cross the center!
6. **Persistence Test**: Close the app (kill it) and restart. You should see a "Searching for previous session" message and return exactly to your last pair.
7. **Export**: Once stability is high (or you finish all pairs), click **View Results** -> **Export to Spotify**. Check your Spotify account for a new playlist named "Taste Engine: Top K".

## 🛠️ Troubleshooting
- **Redirect URI Mismatch**: Ensure you have added `taste-engine://callback` and `exp://127.0.0.1:8081` to your Spotify Developer Dashboard.
- **Scheme Error**: If the app fails to redirect back, ensure you are running in Expo Go and that `app.json` has `"scheme": "taste-engine"`.
