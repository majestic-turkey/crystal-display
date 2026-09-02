try {
    process.loadEnvFile()
} catch {
    // No .env file present, e.g. in Docker where env vars are injected directly.
}
