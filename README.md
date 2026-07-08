# Restaurant Management Application

This is a comprehensive restaurant management platform built with [Next.js](https://nextjs.org).

## Features
- **Role-Based Access Control**: Strict access boundaries between `owner` and `branch_manager` roles.
- **Multi-Branch Support**: Users are securely sandboxed to their assigned branches.
- **In-House Rate Limiting**: Built-in sliding window rate limiter protects against brute-force attacks without requiring external Redis dependencies.
- **Soft Deletion**: Complete audit trail via soft-deletion patterns (`isActive` and `deletedAt`) for all core entities (Staff, Branches, Departments).
- **Zod Data Validation**: Strong request validation ensuring data integrity for Authentication, Attendance, Expenses, etc.
- **Password Security**: Passwords are securely hashed via bcrypt.

## Development

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Testing

Run unit tests via Vitest:
```bash
npm run test
```

## Security & Architecture Notes
- The application utilizes a JSON-blob backend via Drizzle ORM on a Netlify Postgres Database (`NETLIFY_DB_URL`).
- All active limits for the rate limiter are safely maintained within the `rate_limits.json` table and are auto-garbage-collected.
- Session authorization is handled via JWT and HttpOnly secure cookies.
