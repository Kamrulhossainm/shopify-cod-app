-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopSettings" (
    "shop" TEXT NOT NULL,
    "general" TEXT NOT NULL DEFAULT '{}',
    "form" TEXT NOT NULL DEFAULT '{}',
    "shipping" TEXT NOT NULL DEFAULT '{}',
    "otp" TEXT NOT NULL DEFAULT '{}',
    "pixels" TEXT NOT NULL DEFAULT '{}',
    "sheets" TEXT NOT NULL DEFAULT '{}',
    "protection" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopSettings_pkey" PRIMARY KEY ("shop")
);

-- CreateTable
CREATE TABLE "QuantityOffer" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "productScope" TEXT NOT NULL DEFAULT 'all',
    "tiers" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuantityOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Upsell" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "placement" TEXT NOT NULL DEFAULT 'pre_submit',
    "triggerScope" TEXT NOT NULL DEFAULT 'all',
    "offerVariantId" TEXT NOT NULL,
    "offerProductTitle" TEXT NOT NULL DEFAULT '',
    "offerImage" TEXT NOT NULL DEFAULT '',
    "discountType" TEXT NOT NULL DEFAULT 'percentage',
    "discountValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "headline" TEXT NOT NULL DEFAULT 'Wait! Special offer just for you',
    "description" TEXT NOT NULL DEFAULT '',
    "acceptText" TEXT NOT NULL DEFAULT 'Yes, add to my order',
    "declineText" TEXT NOT NULL DEFAULT 'No thanks',
    "downsellEnabled" BOOLEAN NOT NULL DEFAULT false,
    "downsellDiscountType" TEXT NOT NULL DEFAULT 'percentage',
    "downsellDiscountValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "downsellHeadline" TEXT NOT NULL DEFAULT 'Last chance! Even bigger discount',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Upsell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodOrder" (
    "id" TEXT NOT NULL,
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
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shipping" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "codFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "upsellRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otpVerified" BOOLEAN NOT NULL DEFAULT false,
    "ip" TEXT,
    "utm" TEXT,
    "error" TEXT,
    "statusPageUrl" TEXT,
    "upsellToken" TEXT,
    "eventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbandonedOrder" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "data" TEXT NOT NULL,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "recovered" BOOLEAN NOT NULL DEFAULT false,
    "contacted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbandonedOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "token" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
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

