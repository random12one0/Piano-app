import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const dbUrl = `file:${path.join(__dirname, "prisma", "dev.db")}`;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // `adapter` is accepted by the Prisma 7 CLI at runtime but not yet
    // reflected in @prisma/config's published types.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    adapter: async () => new PrismaBetterSqlite3({ url: dbUrl }),
  },
  datasource: {
    url: dbUrl,
  },
});
