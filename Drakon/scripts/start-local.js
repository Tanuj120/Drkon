if (!process.env.SKIP_DB) {
  process.env.SKIP_DB = "true";
}

if (!process.env.PORT) {
  process.env.PORT = "3016";
}

await import("../src/server.js");
