ALTER TABLE "posts" ADD COLUMN "featured_image_url" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "featured_image_alt" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "featured_image_caption" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "featured_image_credit" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "featured_image_credit_url" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "focus_keyword" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "secondary_keywords" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "faq" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "sources" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "created_via" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "api_idempotency_key" text;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_api_idempotency_key_unique" UNIQUE("api_idempotency_key");