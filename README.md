# Team Task Manager

This repository contains a full-stack task manager built with Express, SQLite, and React.

## Features
- User signup / login
- Role-based access (Admin / Member)
- Project creation and member assignment
- Task creation, assignment, status tracking, and overdue reporting
- REST API with validation
- Simple dashboard summaries

## Run locally

1. Install backend dependencies:
   ```bash
   cd server
   npm install
   npm run dev
   ```
2. Install frontend deps and start client:
   ```bash
   cd ../client
   npm install
   npm run dev
   ```

## Deployment
- Deploy the `server` folder to Railway as a Node.js service.
- Set Railway environment variables:
  - `JWT_SECRET` — any secret string
  - `DATABASE_URL=./database.sqlite`
- Railway will install server dependencies, then automatically build the React client and serve `client/dist`.

## Submission
- Live URL: `https://<your-railway-app>.railway.app`
- GitHub repo: `https://github.com/<your-username>/<repo-name>`

## Notes
- The first registered user becomes `ADMIN`.
- `database.sqlite` is created automatically.
