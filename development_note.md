# Development Notes

## Stage 1: Initial Setup
- Imported necessary modules in `msgHandler.js`:
  - `botInstances` for managing bot instances.
  - `handleCommand` for processing commands.
  - `getGroupMode` for managing group-specific behavior.
  - Loaded `ADMIN_NUMBER` from `.env` to identify the admin.

---

## Stage 2: Message Processing
- Implemented logic to process all incoming messages:
  - Logged message details such as sender, receiver, content, and whether it is from the bot itself.
  - Added a placeholder for handling non-command messages.

---

## Stage 3: Command Handling
- Added logic to handle commands (`.command` or `cmd`):
  - **Direct Messages (DMs)**:
    - Allowed commands only if the sender matches the bot instance (`userId`) or is the admin (`ADMIN_NUMBER`).
  - **Group Messages**:
    - Integrated group modes (`me`, `admin`, `all`) to control who can use commands:
      - **`me`**: Only the bot instance owner or admin can use commands.
      - **`admin`**: Only group admins, the bot instance owner, or admin can use commands.
      - **`all`**: Everyone in the group can use commands.

---

## Stage 4: Admin Bot Instance Recognition
- Ensured that the admin bot instance (`userId === "admin"`) is recognized and matched with the admin number (`ADMIN_NUMBER` from `.env`).
- Added logic to allow the admin bot instance to process commands only for itself.

---

## Stage 5: Final Command Filtering
- Ensured that commands are processed only for the correct bot instance:
  - Commands are ignored if the sender does not match the bot instance (`userId`) or the admin bot instance.

---

## Stage 6: Testing and Debugging
- Tested the following scenarios:
  - Commands in DMs:
    - Processed only if the sender matches the bot instance or admin bot instance.
  - Commands in Groups:
    - Processed based on the group mode (`me`, `admin`, `all`).
  - Admin Commands:
    - Ensured that the admin can only use their own bot instance.
  - Non-Admin Commands:
    - Ensured that non-admin users cannot use other users' bot instances.

---

## Stage 7: QR Code Handling
- Updated QR code generation logic:
  - QR codes are sent to the user's DM only once when they are added.
  - QR codes are not regenerated unless the user is re-added.
  - If the QR code is not scanned within 24 hours:
    - The session is deleted.
    - The admin is notified.

---

## Stage 8: Active Bot Instances Command
- Added a new command (`cmd instances`) to list all active bot instances:
  - Displays all currently connected bot instances.
  - Returns a message if no active instances are found.

---

## Stage 9: Enhancements to User Management
- Ensured that:
  - Users cannot receive duplicate QR codes unless they are re-added.
  - Bot instances are properly cleaned up if a session is deleted or expires.
  - Admin commands are restricted to the admin bot instance.

---

## Stage 10: Final Testing
- Tested the following scenarios:
  - Adding a new user:
    - Verified that the QR code is sent only once.
    - Verified that the session is deleted after 24 hours if the QR code is not scanned.
  - Re-adding a user:
    - Verified that a new QR code is sent.
  - Viewing active bot instances:
    - Verified that the `cmd instances` command lists all active bot instances.
    - Verified that the command returns a message if no instances are active.
  - Admin commands:
    - Verified that admin commands work only for the admin bot instance.

---

## Stage 11: Saving Sessions and Numbers to Supabase
- **User Sessions**:
  - Implemented logic to save user sessions to Supabase after successful registration.
  - Verified that user sessions are updated in Supabase when the session state changes.
- **Admin Sessions**:
  - Implemented logic to save the admin session to Supabase after successful registration.
  - Verified that the admin session is updated in Supabase when the session state changes.
- **User Numbers**:
  - Added logic to save user numbers to Supabase when a new user is added.
  - Verified that duplicate user numbers are not saved.
- **Admin Number**:
  - Added logic to save the admin number to Supabase during the admin session initialization.
  - Verified that the admin number is updated in Supabase if it changes.

---

## Stage 12: Improved Reconnection Logic
- Updated the reconnection logic to:
  - Avoid deleting the session folder when the connection closes.
  - Reconnect using the same session data.
  - Retry reconnection only if the user is not logged out.
- Verified that the bot reconnects successfully without regenerating the QR code.

---

## Stage 13: Timeout Handling
- Increased the timeout duration for the `Baileys` library to 60 seconds to reduce timeout errors.
- Added logic to retry operations if a timeout occurs.
- Verified that the bot handles network delays and server-side issues gracefully.

---

## Stage 14: Group Mode Management
- **Group Modes Table**:
  - Updated the `group_modes` table to include `user_id`, `group_id`, `mode`, and timestamps.
  - Ensured that each user-group combination is unique.
- **Default Mode**:
  - Set the default mode for all new groups to `"me"`.
- **Sync Users to Group Modes**:
  - Added logic to sync all users in the `users` table to the `group_modes` table with a default mode.
- **Bot Actions in Groups**:
  - Updated the group mode when the bot performs an action in a group.
- **Messages in Groups**:
  - Updated the group mode when a user receives a message in a group.
- **Joining New Groups**:
  - Added logic to update the group mode when a user joins a new group.

---

## Stage 15: Final Testing and Deployment
- Tested all scenarios, including:
  - Adding new users.
  - Reconnecting after a connection closes.
  - Handling timeout errors.
  - Saving sessions and numbers to Supabase.
  - Syncing users and groups to the `group_modes` table.
  - Updating group modes dynamically based on bot actions, messages, and group joins.
- Deployed the bot to the production environment.

---

## Stage 16: Username Collection and User Management
- **Username Collection**:
  - Implemented logic to request a username from new users after they connect to the bot.
  - Added a `pendingUsernameRequests` set to track users who need to reply with their username.
  - Ensured that usernames are saved only when explicitly requested during registration.
- **Saving Usernames Locally**:
  - Saved usernames to the `bot_number` folder in a file named `<user_id>.txt`.
  - Verified that the file contains the user ID, username, and the date the username was created.
- **Saving Usernames to Supabase**:
  - Added logic to insert new users into the `users` table in Supabase when they reply with their username.
  - Updated existing users' usernames in Supabase if they already exist.
  - Verified that duplicate user entries are not created in the `users` table.
- **Error Handling**:
  - Added error handling for Supabase operations (e.g., checking if a user exists, inserting a new user, updating an existing user).
  - Logged errors for debugging and ensured the bot continues functioning even if Supabase operations fail.
- **Confirmation Messages**:
  - Sent a confirmation message to users after their username was successfully saved.

---

## Stage 17: Bot Owner Name Retrieval
- **Admin Name from `.env`**:
  - Implemented logic to fetch the admin's name from the `.env` file using the `ADMIN_NAME` variable.
  - Verified that the admin's name is correctly retrieved when the bot instance ID is admin.
- **Fallback to Local Files**:
  - Added fallback logic to retrieve the bot owner's name from the `bot_number` folder if the admin's name is not found in `.env`.
  - Verified that the bot owner's name is correctly retrieved from the `<instance_id>.txt` file.
- **Error Handling**:
  - Added type checks to ensure the `instanceId` passed to the `getBotOwnerName` function is a string.
  - Logged errors and returned 'Unknown User' if the `instanceId` is invalid or the file is missing.
- **Testing**:
  - Tested scenarios for retrieving the bot owner's name:
    - Admin name from `.env`.
    - Username from the `bot_number` folder.
    - Invalid `instanceId`.

---

## Stage 18: SQL Updates for `users` Table
- Added `username` column to the `users` table in Supabase.
- Ensured the column is of type `VARCHAR(100)`.
- Implemented SQL queries to:
  - Insert new users into the `users` table with their `user_id` and `username`.
  - Update the `username` for existing users.
  - Query the `users` table to check if a user exists.
- Testing:
  - Verified that usernames are correctly inserted, updated, and queried in the `users` table.
  - Ensured that the `updated_at` column is updated whenever a user's username is modified.

---

## Stage 19: Group Mode Enhancements
- Admin and Superadmin Role Handling:
  - Updated the logic to handle both "admin" and "superadmin" roles for group commands.
  - Ensured that group admins and superadmins can execute commands in "admin" mode.
  - Added a `getGroupAdmins` function to fetch all participants with "admin" or "superadmin" roles.
- Command Filtering:
  - Allowed group admins to execute group-specific commands (handled in `groupcommand.js`) in "admin" mode.
  - Restricted non-group commands to the bot owner (`userId`) or the admin (`ADMIN_NUMBER`).
- Improved Admin Validation:
  - Normalized the sender's ID to match the format of participant IDs in group metadata.
  - Added detailed logging to debug admin validation issues:
    - Logged all participants in the group.
    - Logged the list of admins and superadmins.
- Testing:
  - Verified that group admins and superadmins can execute group commands in "admin" mode.
  - Verified that non-admin users are denied access to group commands in "admin" mode.
  - Verified that non-group commands are restricted to the bot owner or admin.

---

## Stage 20: View-Once Media Handling
- **Detecting View-Once Media**:
  - Implemented `detectViewOnceMedia` to identify view-once media in both direct and quoted messages.
  - Supported media types: `imageMessage`, `videoMessage`, `documentMessage`, `audioMessage`, and `voiceMessage`.
  - Added logging to debug and confirm detection.

- **Reposting View-Once Media**:
  - Implemented `repostViewOnceMedia` to download and repost view-once media.
  - Included tagging the original sender in the reposted message.
  - Added support for reposting captions if available.

- **Error Handling**:
  - Added error handling for expired or unsupported view-once media.
  - Logged errors and sent appropriate messages to the group or user.

- **Testing**:
  - Verified detection and reposting for all supported media types.
  - Tested scenarios for expired media and unsupported media types.

---

## Stage 21: Warning System Enhancements
- **Reset Warnings**:
  - Fixed issues with `resetWarnings` to ensure warnings are deleted from the database.
  - Added debugging logs to confirm the bot instance ID and user ID match during operations.

- **Warning Threshold**:
  - Implemented logic to kick users from groups if their warning count exceeds the threshold.
  - Reset warnings after kicking the user.

- **Testing**:
  - Verified warning reset functionality.
  - Tested kicking users after exceeding the warning threshold.

---

## Stage 22: Welcome Message Enhancements
- **Custom Welcome Messages**:
  - Added support for setting custom welcome messages using `.setwelcome <message>`.
  - Fallback to default welcome messages if no custom message is set.

- **Welcome Message Toggle**:
  - Added `.welcome on/off` to enable or disable welcome messages for groups.

- **Testing**:
  - Verified welcome messages for new group members.
  - Tested enabling and disabling welcome messages.

---

## Stage 23: Admin Commands Enhancements
- **Admin Menu**:
  - Added `cmd menu` to display all admin commands.
  - Included commands for adding, deleting, pausing, and resuming user sessions.

- **Session Management**:
  - Improved logic for pausing and resuming user sessions.
  - Added retries for session operations to handle errors gracefully.

- **Testing**:
  - Verified admin commands for session management.
  - Tested scenarios for invalid commands and missing sessions.

---

## Stage 24: Menu and Command Updates
- **Menu Updates**:
  - Updated the menu to include all new commands.
  - Grouped commands into categories for better readability.

- **Command Testing**:
  - Verified all commands in the menu.
  - Ensured commands are correctly routed to their respective handlers.

---

## Stage 25: Miscellaneous Enhancements
- **Tagging in Messages**:
  - Added support for tagging users in messages (e.g., view-once reposts, warnings).
  - Verified tagging functionality in group and direct messages.

- **Error Logging**:
  - Improved error logging across all modules.
  - Added detailed logs for debugging and troubleshooting.

- **Testing**:
  - Conducted end-to-end testing for all features.
  - Verified compatibility with multiple bot instances.

---

## Stage 26: Group Metadata Error Handling
- Added error handling for `sock.groupMetadata` to ensure the bot gracefully handles failures when fetching group metadata.
- Sent an error message to the group if metadata retrieval fails.
- Testing:
  - Simulated scenarios where group metadata retrieval fails.
  - Verified that the bot logs the error and sends a failure message to the group.

---

## Stage 27: Supabase Integration for Group Modes
- Removed In-Memory Caching:
  - Removed the in-memory `groupModes` object to ensure all group mode operations are performed directly on Supabase.
  - Updated the `getGroupMode` and `setGroupMode` functions to interact only with Supabase.
- Default Group Mode:
  - Ensured that the default group mode is set to "me" for all new groups.
- Testing:
  - Verified that group modes are fetched directly from Supabase.
  - Verified that group modes are updated correctly in Supabase when changed.

---

## Stage 28: Command Routing Enhancements
- Routing Group Commands:
  - Updated `cmdHandler.js` to route group-specific commands to `groupcommand.js` based on the group mode.
  - Ensured that:
    - Commands are routed to `groupcommand.js` only if the sender is authorized (group admin, superadmin, or bot owner).
    - Non-group commands are processed only by the bot owner or admin.
- Testing:
  - Verified that group commands are routed correctly to `groupcommand.js`.
  - Verified that non-group commands are restricted to the bot owner or admin.

---

## Stage 29: Debugging and Logging Improvements
- Improved Logging:
  - Added detailed logs to track:
    - Group mode for each group.
    - Participants and their roles in the group.
    - Admin validation results.
    - Command routing decisions.
- Testing:
  - Verified that logs provide sufficient information to debug issues related to:
    - Group mode validation.
    - Admin validation.
    - Command routing.

---

## Stage 30: Final Testing and Deployment
- Testing:
  - Tested all scenarios, including:
    - Group commands in "admin" mode:
      - Verified that group admins and superadmins can execute commands.
      - Verified that non-admin users are denied access.
    - Group commands in "me" mode:
      - Verified that only the bot owner can execute commands.
    - Non-group commands:
      - Verified that only the bot owner or admin can execute commands.
    - Group metadata retrieval failures:
      - Verified that the bot logs the error and sends a failure message to the group.
- Deployment:
  - Deployed the updated bot to the production environment.

---

## Stage 31: Welcome Message Management
- Welcome Commands:
  - `.welcome on/off`:
    - Added a command to enable or disable welcome messages for a group.
    - Each bot instance can independently manage the welcome status for the same group.
    - Verified that the status is saved to Supabase with `bot_instance_id` for multi-user bot functionality.
  - `.setwelcome <message>`:
    - Added a command to set a custom welcome message for a group.
    - If no custom message is set, the bot uses the group name to generate a default welcome message.
    - Verified that the custom message is saved to Supabase with `bot_instance_id`.
- Welcome Message Logic:
  - New User Joins:
    - Implemented logic to send a welcome message when a new user joins a group.
    - The bot fetches the welcome settings for the specific group and bot instance from Supabase.
    - If welcome messages are enabled:
      - Sends the custom welcome message if set.
      - Otherwise, generates a default message using the group name.
      - Mentions the new user in the welcome message.
- Multi-User Bot Support:
  - Ensured that each bot instance operates independently, even in the same group.
  - Verified that multiple bot instances can have different welcome settings for the same group.
- Testing:
  - Verified the following scenarios:
    - Enable Welcome Messages:
      - Tested `.welcome on` for one bot instance and `.welcome off` for another in the same group.
      - Confirmed that only the enabled bot sends welcome messages.
    - Set Custom Welcome Message:
      - Tested `.setwelcome Welcome to our group!` for one bot instance and a different message for another.
      - Confirmed that each bot sends its respective message.
    - Default Welcome Message:
      - Enabled welcome messages without setting a custom message and verified that the bot uses the group name.
    - Multiple Bot Instances:
      - Added multiple bot instances to the same group with different welcome settings and verified that each bot operates independently.
    - New User Joins:
      - Added a new user to the group and verified that the bot sends the correct welcome message.

---

## Stage 32: Warning System Enhancements
- Warning Commands:
  - `.warn @user <reason>`:
    - Added a command to warn a user with an optional reason.
    - Verified that warnings are tied to the bot instance and stored in Supabase.
  - `.resetwarn @user`:
    - Added a command to reset warnings for a user.
  - `.listwarn`:
    - Added a command to list all warnings in the group.
  - `.warncount <number>`:
    - Added a command to set the warning threshold for the group.
- Testing:
  - Verified that warnings are correctly stored and retrieved from Supabase.
  - Verified that warning thresholds are enforced correctly.

---

## Stage 33: Refactoring and Code Organization
- Centralized Database Logic:
  - Moved all Supabase-related logic for warnings and welcome messages to `warning.js` and `welcome.js`, respectively.
  - Ensured that `groupcommand.js` only calls the appropriate functions from these files.
- Improved Code Reusability:
  - Refactored the `handleNewUserJoin` function to use `sendToChat` for sending messages.
  - Centralized the logic for fetching and managing welcome settings in `welcome.js`.
- Testing:
  - Verified that all commands and logic work as expected after refactoring.
  - Tested edge cases to ensure that the bot handles errors gracefully.


  ## Stage 34: Status View Enhancements
- **Removed Reaction to Status Updates**:
  - Removed the logic for sending reactions to status updates in `statusView.js`.
  - The bot now only views statuses without reacting to them.
- **Testing**:
  - Verified that the bot views all unseen statuses without reacting.
  - Ensured that the bot does not process its own status updates.

---

## Stage 35: New Commands Added
- **Status Commands**:
  - `.status on`:
    - Enables the bot to view all statuses as they are posted.
  - `.status off`:
    - Disables the bot from viewing statuses.
  - `.status react on`:
    - (Deprecated) Removed the ability to react to statuses.
  - `.status react off`:
    - (Deprecated) Removed the ability to disable reactions since reactions are no longer supported.
- **Testing**:
  - Verified that `.status on` and `.status off` work as expected.
  - Ensured that the bot respects the `status_seen` setting for each user.

---

## Stage 36: Menu Updates
- Updated the menu to reflect the new commands:
  - Removed references to status reactions.
  - Added `.status on` and `.status off` commands under the "Utility Commands" section.
- Testing:
  - Verified that the updated menu displays correctly for all users.
  - Ensured that the commands in the menu match their respective handlers.

---

## Stage 37: Final Testing and Deployment
- Conducted end-to-end testing for all features, including:
  - Status viewing functionality.
  - Updated menu commands.
- Deployed the updated bot to the production environment.