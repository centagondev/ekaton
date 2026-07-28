# Ekaton / Campus Connect — Backend Contract (Phase 1)

> Verified by reading backend source directly. Nothing assumed, nothing invented.
> Sources: `config/{urls,settings,asgi,celery}.py`, `core/*`, `apps/{accounts,users,chat,events,complaints,notifications,presence}/*`.

## 1. Global conventions

| Item | Value |
|---|---|
| REST base | `/api/v1/` |
| Auth | JWT (SimpleJWT), `Authorization: Bearer <access>` |
| Access / refresh TTL | 30 minutes / 7 days |
| Refresh | `POST /accounts/refresh/` → **raw** `{access}` (no envelope) |
| Success envelope | `{ success, message, data }` |
| Errors | **Raw DRF** (`{detail}` / `{field:[…]}`); only login-401 and some chat-404s use the envelope |
| WS auth | `?token=<access>` in the query string |
| CORS | `localhost:5173`, `127.0.0.1:5173` |

**Throttles:** `start_chat` **30/min** · `login`/`check_email`/`report` 5/min · `logout` 20/h ·
`set_password`/`reset_password` 10/h · `forget_password` 5/h · `resend_password_reset` 3/h ·
`change_password` 5/h · `complaint_create` 10/h · global user 1000/h.

**Pagination:** page-number (`?page&page_size`, → `{count,next,previous,results}`) for complaints;
cursor (`?cursor`, → `{next,previous,results}`) for comments and event messages.

## 2. Endpoints

### Accounts — `/api/v1/accounts/`
`check-email/` `{email}` → `{is_verified}` ·
`set-password/` `{token,password,confirm_password}` ·
`login/` `{email,password}` → `{access,refresh,user}` ·
`logout/` `{refresh}` ·
`me/` → user ·
`refresh/` `{refresh}` → raw `{access}` ·
`forget-password/` · `resend-password-reset/` · `reset-password/` ·
`change-password/` → `{access,refresh}` (rotates)

**User:** `{id, full_name, email, batch, gender, profile_photo, is_available, is_verified, is_active}`

### Chat — `/api/v1/chat/`
`start/` `{}` → `{status: "waiting"|"matched"|"active", message, room_id?}` ·
`end/` `{room_id}` ·
`report/` `{room_id, reason, description?, evidence_url?}`
reason ∈ `spam|harassment|abusive_language|inappropriate_content|fake_identity|other`

### Events — `/api/v1/events/`
`GET /` (plain array, active + not expired only) · `POST create/` · `GET <pk>/` (+`participant_count`) ·
`PATCH <pk>/update/` (owner) · `DELETE <pk>/cancel/` (owner) · `POST <pk>/join/` · `POST <pk>/leave/` ·
`GET|POST <id>/messages/` (cursor / `{content}` ≤1000; requires active participant else 404)

**Event:** `{id, owner, banner: banner_1…6, name, description, venue, end_time, is_anonymous_chat, status: active|ended|cancelled, created_at}`
**Participant:** `{id, display_name, is_active, joined_at, left_at}`

### Complaints — `/api/v1/complaints/`
`GET /` (paged) · `POST /` · `GET|PATCH|DELETE <id>/` (owner, **5-min window**) ·
`POST <id>/upvote/` (toggle → `{upvote}`) · `GET|POST <id>/comments/` (cursor)
Categories `general|facilities|events|academic|other`; status `open|under_review|resolved|rejected`.

### Empty apps (registered, zero endpoints)
`notifications` · `users` · `presence`

## 3. WebSockets

### Private chat — `ws/chat/<room_id>/?token=`
Close codes: `4001` unauth/inactive · `4004` not found or not a participant · `4000` ended.

**Send:** `chat_message{message}` (1–500) · `typing{is_typing}` · `reveal_request` ·
`reveal_response{status}` · `skip_chat`

**Receive:** `chat_message{id,sender(email),message,created_at}` · `typing{sender,is_typing}` ·
`reveal_request_sent` · `reveal_request_received` · `reveal_success{user{...}}` ·
`reveal_rejected` · `chat_skipped` · `chat_ended` · `error{message}`

⚠️ **Any disconnect permanently ends the room.** No reconnect, no history endpoint.

### Events — `ws/events/<event_id>/?token=`
Close codes: `4001` unauth · `4003` not an active participant (join over REST first).

**Send:** `{content}` · `{type:"typing.start"}` · `{type:"typing.stop"}`
**Receive:** `history{messages}` · `presence.online_users{count,participants}` ·
`presence.joined|presence.left{participant}` · `typing.started|typing.stopped{participant}` ·
**bare** `{id,sender_name,content,created_at}` (no `type`) · `{error}` (no `type`)

`participant.id` is the **EventParticipant** id (matches the join response `id`).

## 4. Flows

**Auth** (invite-only, no signup): admin imports user (`is_verified=false`) → `check-email` →
unverified sends `FRONTEND_URL/set-password?token=…` → `set-password` verifies → `login`.

**Matchmaking** (REST polling; no push): `start/` → `waiting`, then re-poll until `matched`/`active`
returns `room_id`. 30/min throttle ⇒ ~2s polling is safe.

**Reveal:** `reveal_request` → partner accepts/rejects → both receive `reveal_success`
(other user's profile) or `reveal_rejected`.

**Events:** list → `join/` (returns anonymous `display_name`) → REST history + WS live layer → `leave/`.

## 5. ⛔ Required by the brief but ABSENT in the backend

| # | Requirement | Reality | Consequence |
|---|---|---|---|
| 1 | **Auto-end chat after 20s silence** | ✅ **IMPLEMENTED** (2026-07-28): idle watchdog in `ChatConsumer`; resets only on real `chat_message` broadcasts; Redis SET-NX claim → single `chat_timeout` broadcast to both, then close 4000. E2E-verified with two users (1 ms receipt delta). | Clients must handle `{type:"chat_timeout", message}`. |
| 2 | **Realtime match over WebSocket** | No matchmaking consumer / broadcast | Polling only (~2s), not push |
| 3 | **Cancel search** | `remove_user_from_queue()` exists but **no endpoint exposes it** | Cancel only stops client polling; user stays queued |
| 4 | **Private-chat reconnect** | Disconnect ends the room; no history endpoint | Reconnect UX impossible |
| 5 | **Anonymous names in private chat** | Events only; chat WS sends the **sender's real email** | Privacy leak pre-reveal |
| 6 | **Online-user count ("247 students online")** | No endpoint; presence is per-event only | Cannot show a real number |
| 7 | **Notifications (bell icon)** | App is an empty stub | Nothing to wire |
| 8 | **Event start time ("Starts in 2 hours")** | Only `end_time` exists | Can show "ends in …" only |
| 9 | **Event categories (Music/Sports/Hackathon)** | No field | Cannot render real tags |
| 10 | **Event cover images** | Only `banner_1…6` slugs | Generated patterns instead of photos |
| 11 | **Profile edit / avatar upload / availability toggle** | No endpoints (`users` app empty) | Profile is read-only + change-password |

## 6. Known backend defects (reported, not fixed)

1. **Deadlock** — `matchmaking.py:196`: a queued user returns early and never runs the match loop; two concurrent joiners both stay queued forever. Keys have no TTL → poisoned until `redis-cli del waiting_users waiting_users_set`.
2. **Self-match possible** — `matchmaking.py:206-246`: loop can fall through with `waiting_user == user`.
3. **Duplicate sockets** — `consumers.py:48`: no per-user uniqueness, so several tabs on one account share a room (source of the "3 users in one room" report).
4. **Popped user unvalidated** — `is_user_in_active_chat()` exists but is never called.
5. **Dead code** — `redis_utils.py` skip-cooldown helpers unused.
