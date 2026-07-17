CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_daily_dessert_revenue" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "analytics_daily_dessert_revenue_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"day" timestamp NOT NULL,
	"dessert_id" integer NOT NULL,
	"gross_revenue" numeric(10, 2) NOT NULL,
	"quantity_sold" integer NOT NULL,
	"order_count" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_daily_eod_stock" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "analytics_daily_eod_stock_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"day" timestamp NOT NULL,
	"dessert_id" integer NOT NULL,
	"initial_stock" integer NOT NULL,
	"remaining_stock" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_daily_item_sales" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "analytics_daily_item_sales_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"day" timestamp NOT NULL,
	"item_type" varchar(10) NOT NULL,
	"item_id" integer NOT NULL,
	"quantity_sold" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_daily_revenue" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "analytics_daily_revenue_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"day" timestamp NOT NULL,
	"gross_revenue" numeric(10, 2) NOT NULL,
	"order_count" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_monthly_dessert_revenue" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "analytics_monthly_dessert_revenue_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"month" varchar(7) NOT NULL,
	"dessert_id" integer NOT NULL,
	"gross_revenue" numeric(10, 2) NOT NULL,
	"quantity_sold" integer NOT NULL,
	"order_count" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_monthly_revenue" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "analytics_monthly_revenue_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"month" varchar(7) NOT NULL,
	"gross_revenue" numeric(10, 2) NOT NULL,
	"order_count" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_dessert_inventory" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "daily_dessert_inventory_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"day" timestamp NOT NULL,
	"dessertId" integer NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dessert_combo_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "dessert_combo_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"comboId" integer NOT NULL,
	"dessertId" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dessert_combos" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "dessert_combos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"baseDessertId" integer NOT NULL,
	"overridePrice" integer,
	"enabled" boolean DEFAULT true NOT NULL,
	"isDeleted" boolean DEFAULT false NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "desserts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "desserts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"price" integer NOT NULL,
	"description" varchar(255),
	"kind" varchar(20) DEFAULT 'base' NOT NULL,
	"isDeleted" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"isOutOfStock" boolean DEFAULT false NOT NULL,
	"hasUnlimitedStock" boolean DEFAULT false NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_audit_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "inventory_audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"day" timestamp NOT NULL,
	"dessertId" integer,
	"action" varchar NOT NULL,
	"previousQuantity" integer NOT NULL,
	"newQuantity" integer NOT NULL,
	"orderId" integer,
	"userId" text,
	"note" varchar(500),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_item_modifiers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "order_item_modifiers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"orderItemId" integer NOT NULL,
	"dessertId" integer NOT NULL,
	"dessertName" varchar(255) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "order_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"orderId" integer NOT NULL,
	"dessertId" integer NOT NULL,
	"baseDessertName" varchar(255) NOT NULL,
	"inventoryDeducted" boolean NOT NULL,
	"quantity" integer NOT NULL,
	"unitPrice" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"comboId" integer,
	"comboName" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"submissionId" varchar(255) NOT NULL,
	"requestFingerprint" varchar(64) NOT NULL,
	"customerName" varchar(255) DEFAULT '',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"deliveryCost" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"status" varchar NOT NULL,
	"isDeleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "upi_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"label" varchar(255) NOT NULL,
	"upiId" varchar(255) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"isDeleted" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"role" text DEFAULT 'user',
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_daily_dessert_revenue" ADD CONSTRAINT "analytics_daily_dessert_revenue_dessert_id_desserts_id_fk" FOREIGN KEY ("dessert_id") REFERENCES "public"."desserts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_daily_eod_stock" ADD CONSTRAINT "analytics_daily_eod_stock_dessert_id_desserts_id_fk" FOREIGN KEY ("dessert_id") REFERENCES "public"."desserts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_monthly_dessert_revenue" ADD CONSTRAINT "analytics_monthly_dessert_revenue_dessert_id_desserts_id_fk" FOREIGN KEY ("dessert_id") REFERENCES "public"."desserts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_dessert_inventory" ADD CONSTRAINT "daily_dessert_inventory_dessertId_desserts_id_fk" FOREIGN KEY ("dessertId") REFERENCES "public"."desserts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dessert_combo_items" ADD CONSTRAINT "dessert_combo_items_comboId_dessert_combos_id_fk" FOREIGN KEY ("comboId") REFERENCES "public"."dessert_combos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dessert_combo_items" ADD CONSTRAINT "dessert_combo_items_dessertId_desserts_id_fk" FOREIGN KEY ("dessertId") REFERENCES "public"."desserts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dessert_combos" ADD CONSTRAINT "dessert_combos_baseDessertId_desserts_id_fk" FOREIGN KEY ("baseDessertId") REFERENCES "public"."desserts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_audit_log" ADD CONSTRAINT "inventory_audit_log_dessertId_desserts_id_fk" FOREIGN KEY ("dessertId") REFERENCES "public"."desserts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_audit_log" ADD CONSTRAINT "inventory_audit_log_orderId_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_audit_log" ADD CONSTRAINT "inventory_audit_log_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_modifiers" ADD CONSTRAINT "order_item_modifiers_orderItemId_order_items_id_fk" FOREIGN KEY ("orderItemId") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_modifiers" ADD CONSTRAINT "order_item_modifiers_dessertId_desserts_id_fk" FOREIGN KEY ("dessertId") REFERENCES "public"."desserts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_dessertId_desserts_id_fk" FOREIGN KEY ("dessertId") REFERENCES "public"."desserts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_comboId_dessert_combos_id_fk" FOREIGN KEY ("comboId") REFERENCES "public"."dessert_combos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_daily_dessert_revenue_unique" ON "analytics_daily_dessert_revenue" USING btree ("day","dessert_id");--> statement-breakpoint
CREATE INDEX "analytics_daily_dessert_revenue_dessert_idx" ON "analytics_daily_dessert_revenue" USING btree ("dessert_id");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_daily_eod_stock_unique" ON "analytics_daily_eod_stock" USING btree ("day","dessert_id");--> statement-breakpoint
CREATE INDEX "analytics_daily_eod_stock_dessert_idx" ON "analytics_daily_eod_stock" USING btree ("dessert_id");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_daily_item_sales_unique" ON "analytics_daily_item_sales" USING btree ("day","item_type","item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_daily_revenue_day_unique" ON "analytics_daily_revenue" USING btree ("day");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_monthly_dessert_revenue_unique" ON "analytics_monthly_dessert_revenue" USING btree ("month","dessert_id");--> statement-breakpoint
CREATE INDEX "analytics_monthly_dessert_revenue_dessert_idx" ON "analytics_monthly_dessert_revenue" USING btree ("dessert_id");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_monthly_revenue_month_unique" ON "analytics_monthly_revenue" USING btree ("month");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_dessert_inventory_day_dessert_unique" ON "daily_dessert_inventory" USING btree ("day","dessertId");--> statement-breakpoint
CREATE INDEX "daily_dessert_inventory_day_idx" ON "daily_dessert_inventory" USING btree ("day");--> statement-breakpoint
CREATE INDEX "dessert_combo_items_combo_idx" ON "dessert_combo_items" USING btree ("comboId");--> statement-breakpoint
CREATE INDEX "dessert_combo_items_dessert_idx" ON "dessert_combo_items" USING btree ("dessertId");--> statement-breakpoint
CREATE UNIQUE INDEX "dessert_combo_items_unique" ON "dessert_combo_items" USING btree ("comboId","dessertId");--> statement-breakpoint
CREATE INDEX "dessert_combos_base_dessert_idx" ON "dessert_combos" USING btree ("baseDessertId");--> statement-breakpoint
CREATE INDEX "dessert_combos_enabled_idx" ON "dessert_combos" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "dessert_combos_is_deleted_idx" ON "dessert_combos" USING btree ("isDeleted");--> statement-breakpoint
CREATE INDEX "dessert_combos_sequence_idx" ON "dessert_combos" USING btree ("sequence");--> statement-breakpoint
CREATE INDEX "desserts_is_deleted_idx" ON "desserts" USING btree ("isDeleted");--> statement-breakpoint
CREATE INDEX "desserts_enabled_idx" ON "desserts" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "desserts_sequence_idx" ON "desserts" USING btree ("sequence");--> statement-breakpoint
CREATE INDEX "desserts_kind_idx" ON "desserts" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "desserts_active_idx" ON "desserts" USING btree ("isDeleted","enabled","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "desserts_name_unique_active" ON "desserts" USING btree (LOWER("name")) WHERE "isDeleted" = false;--> statement-breakpoint
CREATE INDEX "inventory_audit_log_day_idx" ON "inventory_audit_log" USING btree ("day");--> statement-breakpoint
CREATE INDEX "inventory_audit_log_created_at_desc_idx" ON "inventory_audit_log" USING btree ("createdAt" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "inventory_audit_log_dessert_idx" ON "inventory_audit_log" USING btree ("dessertId");--> statement-breakpoint
CREATE INDEX "inventory_audit_log_order_idx" ON "inventory_audit_log" USING btree ("orderId");--> statement-breakpoint
CREATE INDEX "order_item_modifiers_order_item_idx" ON "order_item_modifiers" USING btree ("orderItemId");--> statement-breakpoint
CREATE INDEX "order_item_modifiers_dessert_idx" ON "order_item_modifiers" USING btree ("dessertId");--> statement-breakpoint
CREATE UNIQUE INDEX "order_item_modifiers_unique" ON "order_item_modifiers" USING btree ("orderItemId","dessertId");--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("orderId");--> statement-breakpoint
CREATE INDEX "order_items_dessert_id_idx" ON "order_items" USING btree ("dessertId");--> statement-breakpoint
CREATE INDEX "order_items_combo_id_idx" ON "order_items" USING btree ("comboId");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_submission_id_unique" ON "orders" USING btree ("submissionId");--> statement-breakpoint
CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "orders_is_deleted_idx" ON "orders" USING btree ("isDeleted");--> statement-breakpoint
CREATE INDEX "orders_active_idx" ON "orders" USING btree ("isDeleted","createdAt");--> statement-breakpoint
CREATE INDEX "orders_status_created_at_idx" ON "orders" USING btree ("status","createdAt");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");