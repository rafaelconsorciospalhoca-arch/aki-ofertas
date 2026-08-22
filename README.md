This is a [Next.js](https://nextjs.org) project for Aki Ofertas, bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting started

### Prerequisites

- Node.js (see `package.json` engines/toolchain, or use a recent LTS)
- A [Neon](https://neon.tech) Postgres database (or any Postgres instance reachable via a connection string)

### Setup

1. Copy the environment template and fill in the values:

   ```bash
   cp .env.example .env
   ```

   - `DATABASE_URL`: your Neon Postgres connection string (Neon dashboard > Connection Details). Note: this project uses **Prisma 7**, whose config format moved the datasource URL out of `schema.prisma` and into `prisma.config.ts` — `DATABASE_URL` is read from there, not from the schema file.
   - `AUTH_SECRET`: generate one with `npx auth secret` and paste the result in.
   - `BLOB_READ_WRITE_TOKEN`: only needed for file uploads (Vercel Blob storage).

2. Install dependencies:

   ```bash
   npm install
   ```

3. Run database migrations:

   ```bash
   npx prisma migrate dev
   ```

4. Seed the database:

   ```bash
   npx prisma db seed
   ```

5. Start the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Without steps 3 and 4, the app will start but most pages won't have any data to show.

### Other useful commands

```bash
npm run build      # production build
npm run test        # run the test suite (vitest)
npm run lint         # lint
npx tsc --noEmit     # type-check
```

## Learn more

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
