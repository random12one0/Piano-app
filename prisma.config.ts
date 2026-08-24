import "dotenv/config";
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // `adapter` is accepted by the Prisma 7 CLI at runtime but not yet
    // reflected in @prisma/config's published types.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    adapter: async () => new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
