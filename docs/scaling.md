# Scaling Recommendations

- Split the Railway monolith when traffic grows: API/websocket scale horizontally, engine remains a single writer per market group, DB worker can be partitioned by event stream, and market maker can run per market family.
- Keep one matching engine responsible for a market at a time unless the order book is sharded explicitly.
- Use Neon pooled connections for serverless/short-lived workloads and direct connections for long-running workers if needed.
- Use Upstash regional placement close to Railway to reduce command latency.
- Add external monitoring for `/ready`, Redis command latency, engine loop errors, websocket client count, and database migration status.
- Move ticker snapshots to retention windows or rollups as volume grows.
