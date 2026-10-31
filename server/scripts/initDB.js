import 'dotenv/config';
import { readFile } from "node:fs/promises";
import pool from "../db.js";

async function initializeDatabase() {
  try {
    const schema = await readFile(
      new URL("../../database/schema.sql", import.meta.url),
      "utf8",
    );

    await pool.query(schema);
    console.log("Database schema initialized successfully.");
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("Database schema initialization failed:", error);
    await pool.end().catch((closeError) => {
      console.error("Failed to close the database pool:", closeError);
    });
    process.exit(1);
  }
}

await initializeDatabase();
