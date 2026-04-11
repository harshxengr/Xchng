-- Better Auth Tables
CREATE TABLE IF NOT EXISTS "user" (
    "id" TEXT PRIMARY KEY,
    "email" TEXT UNIQUE NOT NULL,
    "name" TEXT,
    "emailVerified" BOOLEAN DEFAULT FALSE,
    "image" TEXT,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "session" (
    "id" TEXT PRIMARY KEY,
    "expiresAt" TIMESTAMP NOT NULL,
    "token" TEXT UNIQUE NOT NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "account" (
    "id" TEXT PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP,
    "refreshTokenExpiresAt" TIMESTAMP,
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "verification" (
    "id" TEXT PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP NOT NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Exchange Logic Tables
CREATE TABLE IF NOT EXISTS "Order" (
    "id" TEXT PRIMARY KEY,
    "market" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "filledQuantity" TEXT NOT NULL DEFAULT '0',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Balance" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "available" TEXT NOT NULL DEFAULT '0',
    "locked" TEXT NOT NULL DEFAULT '0',
    UNIQUE("userId", "asset")
);

CREATE TABLE IF NOT EXISTS "Trade" (
    "id" TEXT PRIMARY KEY,
    "tradeId" INTEGER NOT NULL,
    "market" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "sellerUserId" TEXT NOT NULL,
    "timestamp" TIMESTAMP NOT NULL,
    UNIQUE("market", "tradeId")
);

CREATE TABLE IF NOT EXISTS "Kline" (
    "id" TEXT PRIMARY KEY,
    "market" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "bucketStart" TIMESTAMP NOT NULL,
    "open" TEXT NOT NULL,
    "high" TEXT NOT NULL,
    "low" TEXT NOT NULL,
    "close" TEXT NOT NULL,
    "baseVolume" TEXT NOT NULL,
    "quoteVolume" TEXT NOT NULL,
    "trades" INTEGER NOT NULL DEFAULT 0,
    UNIQUE("market", "interval", "bucketStart")
);

CREATE TABLE IF NOT EXISTS "TickerSnapshot" (
    "id" TEXT PRIMARY KEY,
    "market" TEXT NOT NULL,
    "lastPrice" TEXT NOT NULL,
    "high" TEXT NOT NULL,
    "low" TEXT NOT NULL,
    "volume" TEXT NOT NULL,
    "quoteVolume" TEXT NOT NULL,
    "firstPrice" TEXT NOT NULL,
    "priceChange" TEXT NOT NULL,
    "priceChangePercent" TEXT NOT NULL,
    "trades" INTEGER NOT NULL,
    "timestamp" TIMESTAMP NOT NULL
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS "idx_session_userId" ON "session"("userId");
CREATE INDEX IF NOT EXISTS "idx_account_userId" ON "account"("userId");
CREATE INDEX IF NOT EXISTS "idx_verification_identifier" ON "verification"("identifier");
CREATE INDEX IF NOT EXISTS "idx_trade_market_timestamp" ON "Trade"("market", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS "idx_ticker_market_timestamp" ON "TickerSnapshot"("market", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS "idx_kline_market_interval" ON "Kline"("market", "interval", "bucketStart" DESC);
CREATE INDEX IF NOT EXISTS "idx_order_userId" ON "Order"("userId");
CREATE INDEX IF NOT EXISTS "idx_order_market_status" ON "Order"("market", "status");
