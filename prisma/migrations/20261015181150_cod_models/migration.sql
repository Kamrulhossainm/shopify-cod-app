-- CreateTable
CREATE TABLE "ShopSettings" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "general" TEXT NOT NULL DEFAULT '{}',
    "form" TEXT NOT NULL DEFAULT '{}',
    "shipping" TEXT NOT NULL DEFAULT '{}',
    "otp" TEXT NOT NULL DEFAULT '{}',
    "pixels" TEXT NOT NULL DEFAULT '{}',
    "sheets" TEXT NOT NULL DEFAULT '{}',
    "protection" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "QuantityOffer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "productScope" TEXT NOT NULL DEFAULT 'all',
    "tiers" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Upsell" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "placement" TEXT NOT NULL DEFAULT 'pre_submit',
    "triggerScope" TEXT NOT NULL DEFAULT 'all',
    "offerVariantId" TEXT NOT NULL,
    "offerProductTitle" TEXT NOT NULL DEFAULT '',
    "offerImage" TEXT NOT NULL DEFAULT '',
    "discountType" TEXT NOT NULL DEFAULT 'percentage',
    "discountValue" REAL NOT NULL DEFAULT 0,
    "headline" TEXT NOT NULL DEFAULT 'Wait! Special offer just for you',
    "description" TEXT NOT NULL DEFAULT '',
    "acceptText" TEXT NOT NULL DEFAULT 'Yes, add to my order',
    "declineText" TEXT NOT NULL DEFAULT 'No thanks',
    "downsellEnabled" BOOLEAN NOT NULL DEFAULT false,
    "downsellDiscountType" TEXT NOT NULL DEFAULT 'percentage',
    "downsellDiscountValue" REAL NOT NULL DEFAULT 0,
    "downsellHeadline" TEXT NOT NULL DEFAULT 'Last chance! Even bigger discount',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "revenue" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CodOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "shopifyOrderId" TEXT,
    "shopifyOrderName" TEXT,
    "draftOrderId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT NOT NULL,
    "lineItems" TEXT NOT NULL,
    "subtotal" REAL NOT NULL DEFAULT 0,
    "shipping" REAL NOT NULL DEFAULT 0,
    "discount" REAL NOT NULL DEFAULT 0,
    "codFee" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "upsellRevenue" REAL NOT NULL DEFAULT 0,
    "otpVerified" BOOLEAN NOT NULL DEFAULT false,
    "ip" TEXT,
    "utm" TEXT,
    "error" TEXT,
    "statusPageUrl" TEXT,
    "upsellToken" TEXT,
    "eventId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AbandonedOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "data" TEXT NOT NULL,
    "total" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "recovered" BOOLEAN NOT NULL DEFAULT false,
    "contacted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "token" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "QuantityOffer_shop_idx" ON "QuantityOffer"("shop");

-- CreateIndex
CREATE INDEX "Upsell_shop_idx" ON "Upsell"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "CodOrder_upsellToken_key" ON "CodOrder"("upsellToken");

-- CreateIndex
CREATE INDEX "CodOrder_shop_createdAt_idx" ON "CodOrder"("shop", "createdAt");

-- CreateIndex
CREATE INDEX "CodOrder_shop_phone_idx" ON "CodOrder"("shop", "phone");

-- CreateIndex
CREATE INDEX "AbandonedOrder_shop_createdAt_idx" ON "AbandonedOrder"("shop", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AbandonedOrder_shop_sessionKey_key" ON "AbandonedOrder"("shop", "sessionKey");

-- CreateIndex
CREATE UNIQUE INDEX "OtpCode_token_key" ON "OtpCode"("token");

-- CreateIndex
CREATE INDEX "OtpCode_shop_phone_idx" ON "OtpCode"("shop", "phone");
