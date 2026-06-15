# Tasker — Calm Task Management App

A full-stack task management web application built with Node.js, Express, SQLite, and vanilla JavaScript.

---

## Features

- User Registration & Login with JWT authentication
- Create, Edit, Delete tasks
- Set task Status — To Do / In Progress / Done
- Set task Priority — Low / Medium / High
- Set Due Dates with overdue highlighting
- Search tasks by title
- Filter tasks by status and priority
- Real-time stats dashboard (total, todo, in-progress, done)
- Dark / Light mode toggle
- Responsive design (mobile friendly)
- Landing page with feature highlights

---

## Tech Stack

| Layer     | Technology              |
|-----------|-------------------------|
| Frontend  | HTML, CSS, JavaScript   |
| Backend   | Node.js, Express.js     |
| Database  | SQLite (sqlite3)        |
| Auth      | JWT (jsonwebtoken)      |
| Password  | bcryptjs (hashed)       |

---

## Project Structure

```
tasker-app/
├── frontend/
│   ├── index.html       # Main HTML (landing + auth + app)
│   ├── style.css        # All styles + dark mode
│   └── app.js           # Frontend logic
└── server/
    ├── index.js         # Express server entry point
    ├── db.js            # SQLite database setup
    ├── middleware.js     # JWT auth middleware
    ├── package.json
    └── routes/
        ├── auth.js      # /register, /login
        └── tasks.js     # CRUD task routes
```

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org) v18 or higher

### Installation & Run

**Clone the repository:**
```bash
git clone https://github.com/YOUR_USERNAME/tasker-app.git
```

**Navigate to the server folder:**
```bash
cd tasker-app/server
```

**Install dependencies:**
```bash
npm install
```

**Start the server:**
```bash
node index.js
```

### Open the App

Visit in your browser:
```
http://localhost:3001
```

---

## API Endpoints

| Method | Endpoint          | Description          | Auth |
|--------|-------------------|----------------------|------|
| POST   | /register         | Register new user    | No   |
| POST   | /login            | Login user           | No   |
| GET    | /api/me           | Get current user     | Yes  |
| GET    | /api/tasks        | Get all tasks        | Yes  |
| GET    | /api/tasks/stats  | Get task stats       | Yes  |
| POST   | /api/tasks        | Create a task        | Yes  |
| PUT    | /api/tasks/:id    | Update a task        | Yes  |
| DELETE | /api/tasks/:id    | Delete a task        | Yes  |

---

## Screenshots

### Landing Page
- Hero section with app description and feature cards
- Navigate to Register or Login

### Auth Page
- Sign In / Sign Up tabs
- Secure password hashing

### Dashboard
- Stats row showing task counts
- Task list with priority color indicators
- Sidebar with filter navigation

---

## Developer

**Deepa M**  
Full Stack Internship Project  
Built with Node.js + Express + SQLite + Vanilla JS
