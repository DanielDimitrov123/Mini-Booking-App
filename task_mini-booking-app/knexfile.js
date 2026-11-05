/* eslint-disable @typescript-eslint/no-require-imports */
require("dotenv").config({ path: ".env.local" });

module.exports = {
  development: {
    client: "pg",
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: "./db/migrations",
      extension: "js",
    },
    seeds: {
      directory: "./db/seeds",
      extension: "js",
    },
  },
};