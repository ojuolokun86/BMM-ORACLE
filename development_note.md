# Development Notes (Up to Date)

## Core Architecture
- **Multi-user, multi-instance WhatsApp bot** using Node.js, Baileys, and Supabase.
- Each user runs their own bot instance, with subscription-based limits and memory quotas.
- **All bot state, sessions, and settings** are managed in Supabase and in-memory caches.
- **Admin dashboard** and REST API for user/bot/session management.

---

## Main Features

### 1. Session & User Management
- Hybrid auth state: sessions are stored in memory and Supabase.
- QR code and pairing code registration, with QR sent via WebSocket and DM.
- Session healing and auto-restart on disconnect or error.
- User registration, login, password reset, and complaint system.
- Subscription system: free, basic, trier, gold, premium (limits bots, memory, features).

### 2. Command Routing & Permissions
- **Per-group command permissions:** `me`, `admin`, `all`.
- **Admin commands** restricted to admin bot instance.
- **Command routing** based on group mode, sender, and bot instance.
- **Prefix system:** Each user can set their own command prefix.

### 3. Group Management
- **Welcome messages:** Custom per group, enable/disable, Supabase-backed.
- **Warning system:** Warn, resetwarn, listwarn, warncount, auto-kick on threshold.
- **Kick inactive:** Detects and removes inactive members, supports `.cancelk`.
- **Kick all:** Removes all non-admins, supports `.cancelkick`.
- **Destroy group:** Removes all, demotes admins, leaves group, supports `.canceldestroy`.
- **Tagall:** Tag all members, supports formatted/plain, random emoji, admin tag.
- **Polls:** Start, vote, end, with live results.
- **Announcements:** Scheduled group announcements, start/stop, interval parsing.

### 4. Protection & Moderation
- **Anti-link:** Detects links, warns/kicks, admin bypass, user bypass, warning count.
- **Antidelete:** Restores deleted messages/media, per-group or global, with memory cleanup.
- **DND (Do Not Disturb):** Modes for all, voice, video, contacts only, whitelist/blacklist.
- **Security:** `.protect` enables anti-bug/anti-spam, `.bug` for premium users.

### 5. Media & Utility
- **Media handling:** Download, store, and restore images, videos, audio, stickers, documents.
- **View-once repost:** Detects and reposts view-once media, supports reply-based repost.
- **Downloader:** Download video/audio/lyrics from URLs.
- **AI & Fun:** `.ai` (multi-backend), `.imagine` (image gen), fun commands (hug, slap, etc.), emoji/sticker/joke/quote/translate.
- **Alive, ping, info, about:** Status and info commands.
- **Time:** Get time for any country (with aliases).

### 6. Status & Presence
- **Status view/react:** Auto-view and react to statuses if enabled.
- **Dynamic presence:** Shows typing/recording, resets after cooldown.

### 7. Settings & Customization
- **Set prefix, tagformat, name, pic, status, presence, DND, formatrespond.**
- **Per-user/group settings** cached in memory for speed.
- **Settings aggregator** for `.alive` and info commands.

### 8. Memory & Analytics
- **Memory usage tracking** per bot/user.
- **Uptime, last active, analytics, activity log** for each bot.
- **ROM/RAM quotas** enforced per subscription.

### 9. Admin & API
- **Admin API:** Add/delete/restart/stop/start bots, send notifications, view metrics.
- **User API:** Register, login, manage bots, fetch analytics, submit complaints.
- **WebSocket:** Real-time updates for dashboard and QR code delivery.

---

## Technical Details

- **Baileys v6+** for WhatsApp Web API.
- **Supabase** for DB, storage, and auth.
- **Socket.IO** for real-time dashboard and QR code delivery.
- **Express** for REST API.
- **In-memory caches** for settings, stats, and queues.
- **Per-user/group queues** for sequential message processing.
- **Robust error handling:** Session healing, auto-restart, memory cleanup.
- **Extensive logging** for debugging and analytics.

---

## Recent Additions & Fixes

- **Kick/cancel logic:** `.cancelk`, `.cancelkick`, `.canceldestroy` can interrupt operations mid-way.
- **Antidelete:** Improved memory retention, supports media, cleans up old messages.
- **sendToChat:** Unified message sending, supports media, mentions, contextInfo, newsletter preview.
- **Menu:** Uses sendToChat, no image by default, always up to date.
- **DND:** Full support for all modes, whitelist/blacklist, contacts only.
- **Fun commands:** Expanded with more actions and Giphy integration.
- **Downloaders:** Video/audio/lyrics with fallback APIs.
- **View-once:** Reply-based repost, robust detection.
- **Settings:** All user/group/bot settings are cached and aggregated.
- **Admin dashboard:** Live metrics, analytics, bot/user management.
- **Memory cleanup:** Regular cleanup for antidelete/media stores.
- **Session healing:** On error, auto-restart and notify user.
- **Complaint system:** Users can submit complaints, admin can view/delete.

---

## Database Structure

- **users, user_auth, subscription_tokens, sessions, welcome_settings, group_settings, warnings, antidelete_settings, antilink_settings, notifications, notification_reads, complaints, group_modes, announcements, security_logs** (see `dataset.sql`).

---

## Testing & Deployment

- All features tested in DM and group contexts.
- All commands tested for permission, error handling, and edge cases.
- Deployed to production with regular memory and session sync to Supabase.

---

_Last updated: June 2025_