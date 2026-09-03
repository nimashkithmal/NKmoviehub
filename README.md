# NKMovieHUB

Full-stack movie and TV streaming catalog for **NK Movie Hub** — React frontend, Node.js/Express API, MongoDB, Cloudinary, and 2embed discovery.

## Live site

[![NKMovieHUB — live home page](https://image.thum.io/get/width/1200/crop/675/noanimate/https://nkmoviehub.vercel.app)](https://nkmoviehub.vercel.app)

**[Open live site →](https://nkmoviehub.vercel.app)** · **[Admin login →](https://nkmoviehub.vercel.app/login)**

The preview above is pulled from the live URL when you view this README (no screenshot files in the repo). GitHub does not allow a full interactive embed inside markdown — click the image or links to use the site.

| Area | URL |
|------|-----|
| Home | [nkmoviehub.vercel.app](https://nkmoviehub.vercel.app) |
| Admin login | [nkmoviehub.vercel.app/login](https://nkmoviehub.vercel.app/login) |

## What it does

### Public site
- Browse **movies** and **TV shows** with search, filters, genres, and language options
- Movie detail pages, TV watch pages with **seasons and episodes**
- Ratings, collections, coming soon, banners, and SEO-friendly pages
- Contact form with email notifications

### Admin dashboard (`/admin`)
- **Movies & TV shows** — add, edit, delete, active / inactive / coming soon
- **2embed sync** — search by title, queue new titles, review seasons/episodes, approve to catalog
- TV shows: all seasons/episodes fetched from 2embed on approve (not only season 1)
- **Banners**, **collections**, **contacts**, **analytics**
- **Cast** indexing from 2embed metadata

### Admin accounts
- **Super admin** (`SUPER_ADMIN_EMAIL`, default `qwe730375@gmail.com`) can **invite new admins**
- Invite flow: enter name + email → system emails a **temporary password** → new admin logs in at `/login` → **OTP** to their email → set a **permanent password** → full admin access
- Other admins see the admin list but **cannot** invite new admins
- Admin login is separate from the public site (`/login` is admin-only)

## Tech stack

| Layer | Tools |
|-------|--------|
| Frontend | React, React Router, Context API, CSS |
| Backend | Node.js, Express, Mongoose |
| Database | MongoDB |
| Auth | JWT, bcrypt |
| Email | Nodemailer (Gmail SMTP) |
| Images | Cloudinary |
| Catalog source | [2embed API](https://api.2embed.cc) (trending + search) |

## Project structure

```
NKMovieHUB/
├── client/                 # React app (Vercel)
│   └── src/components/     # Home, grids, watch pages, AdminDashboard, etc.
├── server/                 # Express API
│   ├── models/             # Movie, TVShow, User, PendingTitle, …
│   ├── routes/             # movies, tvshows, sync, auth, users, …
│   ├── utils/              # embedSyncIndexer, tvSeasonEpisodes, castIndexer, …
│   ├── services/           # emailService
│   └── constants/          # adminAccess (super admin email)
└── README.md
```

## Local setup

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Gmail app password (for admin invite / password reset emails)
- Cloudinary account (posters and banners)

### Install

```bash
git clone https://github.com/nimashkithmal/NKMovieHUB.git
cd NKMovieHUB

cd server && npm install
cd ../client && npm install
```

### Environment (`server/config.env`)

```env
PORT=5001
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_secret

EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-gmail-app-password

SUPER_ADMIN_EMAIL=qwe730375@gmail.com
CLIENT_URL=http://localhost:3000
SITE_URL=http://localhost:3000

CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

### Run

```bash
# Terminal 1
cd server && npm start

# Terminal 2
cd client && npm start
```

- Frontend: http://localhost:3000  
- API: http://localhost:5001  
- Health: http://localhost:5001/api/health  

## Admin workflows (summary)

### Invite a new admin (super admin only)
1. Administration → **Add New Admin**
2. Full name + email → **Send Admin Invite**
3. New admin receives a **temporary password** by email
4. They log in at `/login`, complete **OTP** + **new password** setup

## API overview

| Prefix | Purpose |
|--------|---------|
| `/api/auth` | Login, forgot password, OTP, reset password |
| `/api/users` | Admin list, invite (super admin), status toggle |
| `/api/movies` | Public + admin movie CRUD |
| `/api/tvshows` | Public + admin TV CRUD |
| `/api/sync` | 2embed sync, pending titles, approve/dismiss |
| `/api/contacts` | Contact form + admin replies |
| `/api/embed` | Season/episode proxy for 2embed |

## Deployment notes

- **Frontend**: Vercel (`client/`, `vercel.json` proxies SEO prerender to API)
- **Backend**: separate host (API URL configured in Vercel rewrites / env)
- Set `CLIENT_URL` and `SITE_URL` to the production frontend URL in production

## Author

**Nimash Kithmal** — [GitHub](https://github.com/nimashkithmal)
