<div align="center">

# 🔒 Ekaton

**A modern, anonymous communication platform for verified college communities.**

Connect anonymously. Chat securely. Stay private.

[![Python](https://img.shields.io/badge/Python-3.x-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Django](https://img.shields.io/badge/Django-REST_Framework-092E20?logo=django&logoColor=white)](https://www.django-rest-framework.org/)
[![Channels](https://img.shields.io/badge/Django_Channels-WebSockets-092E20?logo=django&logoColor=white)](https://channels.readthedocs.io/)
[![React](https://img.shields.io/badge/React-TypeScript-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-Build_Tool-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind](https://img.shields.io/badge/Tailwind-CSS-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Production-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-Cache_%26_Channels-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](#license)

</div>

---

## 📖 Table of Contents

- [Project Overview](#-project-overview)
- [Features](#-features)
- [Architecture Overview](#-architecture-overview)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Installation](#-installation)
- [API Overview](#-api-overview)
- [Authentication Flow](#-authentication-flow)
- [Chat Flow](#-chat-flow)
- [Admin Features](#-admin-features)
- [Message Encryption](#-message-encryption)
- [Security](#-security)
- [Development Commands](#-development-commands)
- [Testing](#-testing)
- [Code Style](#-code-style)
- [Contributing](#-contributing)
- [License](#-license)
- [Author](#-author)

---

## 🧭 Project Overview

**Ekaton** is a privacy-first communication platform designed for college communities. It allows verified students to connect anonymously through **one-to-one chats** and participate in **anonymous or non-anonymous group events** — all without exposing personal identity unless both parties choose to reveal it.

The platform is built around three core principles:

- **Privacy** — identities stay hidden until explicitly revealed by mutual consent
- **Simplicity** — a clean, focused chat and events experience
- **Security** — encrypted messaging, JWT-based auth, and permission-controlled APIs

---

## ✨ Features

### 🔐 Authentication
- Email verification
- Password reset
- JWT authentication
- Secure login

### 👤 Users
- User profile
- Profile editing
- Availability status

### 💬 Anonymous Chat
- Random matchmaking
- Private one-to-one chat
- Real-time messaging (WebSockets)
- Typing indicator
- Reveal request / Accept reveal / Reject reveal
- Skip chat
- Chat history
- Message encryption before storing in the database

### 📅 Events
- Create events
- Anonymous events
- Non-anonymous events
- Group chat support

### 🛠️ Administration
- Admin authentication
- Dashboard
- User management
- Search & filter users
- User statistics
- Report management (create, search, filter, status update)

### 🔒 Security
- JWT authentication
- Protected APIs
- Encrypted private messages
- Permission-based authorization
- Secure password reset flow

---

## 🏗️ Architecture Overview

Ekaton follows a **decoupled client-server architecture**:

```
┌──────────────────┐        REST / WebSocket        ┌────────────────────┐
│   React + Vite    │ ─────────────────────────────▶ │   Django + DRF     │
│   (Frontend SPA)   │ ◀───────────────────────────── │  Django Channels    │
└──────────────────┘                                  └─────────┬──────────┘
                                                                 │
                                          ┌──────────────────────┼────────────────────┐
                                          ▼                      ▼                    ▼
                                    ┌───────────┐         ┌────────────┐       ┌────────────┐
                                    │ PostgreSQL │        │   Redis    │       │  Fernet     │
                                    │ (prod DB)  │        │ (Channels/ │       │ Encryption  │
                                    │  SQLite    │        │  caching)  │       │  Layer      │
                                    │  (dev DB)  │        └────────────┘       └────────────┘
                                    └───────────┘
```

- **Django REST Framework** serves standard HTTP APIs (auth, profiles, events, admin)
- **Django Channels + Redis** power real-time WebSocket features (matchmaking, chat, typing indicators)
- **Fernet encryption** secures message content before it touches the database

---

## 🧰 Tech Stack

| Layer          | Technology                                             |
|----------------|---------------------------------------------------------|
| **Backend**    | Python, Django, Django REST Framework, Django Channels  |
| **Real-time**  | WebSockets, Redis                                        |
| **Database**   | PostgreSQL (production), SQLite (development)            |
| **Auth**       | JWT Authentication                                       |
| **Encryption** | Fernet (symmetric message encryption)                    |
| **Frontend**   | React, TypeScript, Vite                                  |
| **Styling**    | Tailwind CSS                                             |

---

## 📂 Project Structure

```
ekaton/
├── backend/
│   ├── config/                # Django project settings & ASGI/WSGI entry points
│   ├── authentication/        # Signup, email verification, password reset, JWT
│   ├── users/                 # Profiles, availability status
│   ├── chat/                  # Matchmaking, WebSocket consumers, reveal logic
│   ├── events/                # Event creation & group chat
│   ├── administration/        # Admin dashboard, user & report management
│   ├── encryption/             # Fernet-based message encryption utilities
│   ├── manage.py
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/             # Route-level views
│   │   ├── hooks/             # Custom React hooks
│   │   ├── services/          # API & WebSocket clients
│   │   └── types/             # TypeScript type definitions
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
│
└── README.md
```

> **Note:** Folder names above reflect the logical module breakdown of the project. Adjust paths to match your local checkout if they differ.

---

## ⚙️ Installation

### Requirements

| Requirement | Version              |
|-------------|-----------------------|
| Python      | 3.10+                 |
| Node.js     | 18+                   |
| PostgreSQL  | 14+ (production)      |
| Redis       | 6+                    |

### 1. Clone the Repository

```bash
git clone https://github.com/<your-org>/ekaton.git
cd ekaton
```

### 2. Create a Virtual Environment

```bash
cd backend
python -m venv venv
source venv/bin/activate      # macOS/Linux
venv\Scripts\activate         # Windows
```

### 3. Install Dependencies

```bash
# Backend
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

### 4. Environment Variables

Create a `.env` file inside the `backend/` directory:

```env
# Django
SECRET_KEY=your-django-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database (Production)
DATABASE_URL=postgres://user:password@localhost:5432/ekaton

# Redis
REDIS_URL=redis://localhost:6379/0

# JWT
ACCESS_TOKEN_LIFETIME_MINUTES=15
REFRESH_TOKEN_LIFETIME_DAYS=7

# Encryption
FERNET_KEY=your-generated-fernet-key

# Email (for verification & password reset)
EMAIL_HOST=smtp.example.com
EMAIL_HOST_USER=your-email@example.com
EMAIL_HOST_PASSWORD=your-email-password
```

> **Tip:** Generate a Fernet key with:
> ```bash
> python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
> ```

### 5. Database Setup

```bash
# Development (SQLite) works out of the box.
# For production (PostgreSQL), ensure DATABASE_URL is set, then:
python manage.py migrate
```

### 6. Redis Setup

Ensure Redis is installed and running locally:

```bash
redis-server
```

> **Warning:** Django Channels requires Redis to be running for real-time chat and matchmaking to work. Without it, WebSocket connections will fail.

### 7. Run the Backend

```bash
cd backend
python manage.py runserver
```

### 8. Run the Frontend

```bash
cd frontend
npm run dev
```

---

## 🔌 API Overview

Ekaton exposes REST endpoints for standard operations and WebSocket endpoints for real-time features.

| Category        | Type       | Examples                                  |
|-----------------|------------|--------------------------------------------|
| Authentication  | REST       | Register, verify email, login, reset password |
| Users           | REST       | Get/update profile, set availability       |
| Chat            | WebSocket  | Match, message, typing indicator, reveal   |
| Chat History    | REST       | Fetch past conversations                   |
| Events          | REST       | Create/list events, join group chat        |
| Administration  | REST       | Manage users, manage reports, view stats   |

---

## 🔑 Authentication Flow

1. User registers with an email address
2. A verification email is sent to confirm identity
3. User logs in and receives a **JWT access & refresh token pair**
4. Subsequent requests are authenticated via the access token
5. Password reset is available through a secure, token-based reset flow

---

## 💬 Chat Flow

1. User opts into **random matchmaking**
2. Backend pairs two available users via Redis-backed matchmaking
3. A private, real-time chat session opens over WebSockets
4. Either user can:
   - Send a **reveal request**
   - **Accept** or **reject** a reveal
   - **Skip** the current chat to be re-matched
5. Messages are encrypted before being persisted, and past conversations remain accessible as **chat history**

---

## 🛡️ Admin Features

The admin dashboard provides tools for platform moderation and oversight:

- Separate **admin authentication**
- Centralized **dashboard** with platform statistics
- **User management** — search and filter users
- **Report management** — view, search, filter, and update the status of user reports

---

## 🔐 Message Encryption

All private chat messages are encrypted using **Fernet symmetric encryption** before being stored in the database. This ensures that message content is not stored or transmitted in plaintext at rest.

```
Plaintext Message → Fernet Encrypt → Stored in DB → Fernet Decrypt → Displayed to Recipient
```

---

## 🛡️ Security

| Measure                         | Description                                             |
|----------------------------------|----------------------------------------------------------|
| JWT Authentication                | Stateless, token-based auth for all protected routes     |
| Protected APIs                    | Endpoints require valid, non-expired tokens               |
| Encrypted Private Messages        | Fernet encryption applied before persistence               |
| Permission-Based Authorization     | Role/permission checks on sensitive operations            |
| Secure Password Reset Flow        | Token-based, time-limited reset links                     |

---

## 🧑‍💻 Development Commands

```bash
# Backend
python manage.py runserver          # Start dev server
python manage.py migrate            # Apply migrations
python manage.py makemigrations     # Create new migrations
python manage.py createsuperuser    # Create an admin user

# Frontend
npm run dev                         # Start Vite dev server
npm run build                       # Production build
```

---

## 🧪 Testing

```bash
# Backend
python manage.py test

# Frontend
npm run test
```

> **Note:** Ensure Redis and the database are running before executing backend tests that touch chat or matchmaking logic.

---

## 🎨 Code Style

- **Backend:** Follows PEP 8 conventions for Python/Django code
- **Frontend:** TypeScript with strict typing enabled; styling via Tailwind CSS utility classes
- Keep components and Django apps modular and single-responsibility

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m "Add your feature"`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

Please ensure your code follows the existing style and includes relevant tests where applicable.

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

---

## 👤 Author

**Wasim**
Solo developer & founder — building Ekaton for anonymous, secure student communication.
