# Snnai Music Player 🎵

> **Pure Sound, Infinite Playback.** A gorgeous, lightning-fast desktop music player that combines official SoundCloud API streaming and iTunes search into a single glassmorphic experience. Powered by Tauri, Rust, and Supabase.

This repository is organized as a monorepo containing both the desktop application and its companion landing website.

---

## 📂 Repository Structure

- **[`snnai-music-player`](./snnai-music-player)**: The core desktop application built with Tauri v2, React, TypeScript, and Rust.
- **[`snnai-website`](./snnai-website)**: The static marketing landing page showcasing features, providing installer downloads, and hosting the password reset gateway (designed to be hosted on Vercel).

---

## ✨ Features

- **Unified Dual Search**: Search SoundCloud and iTunes concurrently to stream tracks with high-quality fallback routing.
- **Smart Autoplay**: Never let the silence take over. Snnai automatically fetches recommendations and queues related tracks when your playback queue runs dry.
- **SQLite Local Cache**: Local persistent caching of your settings, SoundCloud credentials, and audio streams for sub-millisecond start times.
- **Supabase Cloud Sync**: Synchronize playlists, search history, and user settings across devices with zero setup.
- **Beautiful Lyrics View**: Responsive panel featuring synchronized lyrics powered by LRCLIB.
- **Glassmorphic UI**: Sleek, modern, and dark-themed visual layout with premium micro-animations.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Zustand (State Management), TailwindCSS, Lucide Icons.
- **Backend / Desktop Engine**: Rust, Tauri v2.
- **Database / Cloud Auth**: Supabase JS, SQLite (local config database).
- **Audio Extraction**: Integrated `yt-dlp` Rust sidecar.

---

## 🚀 Quick Start

### Prerequisites

To build Snnai from source, make sure you have installed:
1. [Node.js](https://nodejs.org/) (v18 or higher)
2. [Rust / Cargo Compiler](https://www.rust-lang.org/tools/install)
3. Windows C++ Build Tools (via Visual Studio Installer, select "Desktop development with C++")

### Running the App Locally

1. Clone the repository:
   ```bash
   git clone https://github.com/SnaiKun/Snnai-Music-Player.git
   cd Snnai-Music-Player
   ```

2. Install dependencies:
   ```bash
   cd snnai-music-player
   npm install
   ```

3. Run the Tauri development server:
   ```bash
   npm run tauri dev
   ```

### Building the Production Installer

To compile the production release and generate a Windows setup installer (`.exe`):
```bash
npm run tauri build
```
The installer will be generated in `src-tauri/target/release/bundle/nsis/`.

### Hosting the Web Page (Vercel)

The website is a static webpage. To host it on Vercel:
1. Connect your repository to Vercel.
2. Select **`snnai-website`** as the **Root Directory**.
3. Deploy!

---

## 💖 Support the Project

Snnai is completely **free, open-source, and has absolutely no paywalls or advertisements**. 

If Snnai has improved your music-listening experience and you want to keep motivating me to add new features, maintain dependencies, and keep updating the app, please consider supporting me:

- **Ko-fi**: [ko-fi.com/your-username](https://ko-fi.com/) -- bro haven't created it yet! XD

Every donation, no matter the size, goes directly toward motivation and keeping the project alive. Thank you so much! 🙏

---

## 📄 License

This project is licensed under the MIT License. Feel free to fork, tweak, and share!
