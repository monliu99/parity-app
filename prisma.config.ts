// Prisma CLI config.
//
// Env precedence: variables already set in the shell > .env.local > .env.
// Never use `override: true` here. It would make an explicit DATABASE_URL
// (for example, `DATABASE_URL=<prod> npx prisma migrate deploy`) silently fall
// back to whatever .env.local points at.
import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
