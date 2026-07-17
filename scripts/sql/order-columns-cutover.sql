DO $$
DECLARE
	expected record;
	actual record;
BEGIN
	IF to_regclass('public.orders') IS NULL
		OR to_regclass('public.order_items') IS NULL
		OR to_regclass('public.order_item_modifiers') IS NULL
		OR to_regclass('public.desserts') IS NULL
		OR to_regclass('public.inventory_audit_log') IS NULL THEN
		RAISE EXCEPTION 'CUTOVER: required public tables are missing.';
	END IF;

	FOR expected IN
		SELECT * FROM (
			VALUES
				('orders', 'submissionId', 'character varying', 255),
				('orders', 'requestFingerprint', 'character varying', 64),
				('order_items', 'baseDessertName', 'character varying', 255),
				('order_items', 'inventoryDeducted', 'boolean', NULL::integer),
				('order_item_modifiers', 'dessertName', 'character varying', 255)
		) AS definitions(table_name, column_name, data_type, maximum_length)
	LOOP
		SELECT columns.data_type,
		       columns.character_maximum_length,
		       columns.column_default,
		       columns.is_generated
		INTO actual
		FROM information_schema.columns
		WHERE columns.table_schema = 'public'
		  AND columns.table_name = expected.table_name
		  AND columns.column_name = expected.column_name;

		IF FOUND AND (
			actual.data_type IS DISTINCT FROM expected.data_type
			OR actual.character_maximum_length IS DISTINCT FROM expected.maximum_length
			OR actual.column_default IS NOT NULL
			OR actual.is_generated IS DISTINCT FROM 'NEVER'
		) THEN
			RAISE EXCEPTION 'CUTOVER: %.% has an unexpected definition.', expected.table_name, expected.column_name;
		END IF;
	END LOOP;

	IF to_regclass('public.orders_submission_id_unique') IS NOT NULL AND NOT EXISTS (
		SELECT 1
		FROM pg_class index_class
		JOIN pg_namespace namespace ON namespace.oid = index_class.relnamespace
		JOIN pg_index index_data ON index_data.indexrelid = index_class.oid
		JOIN pg_attribute attribute
		  ON attribute.attrelid = index_data.indrelid
		 AND attribute.attnum = index_data.indkey[0]
		WHERE namespace.nspname = 'public'
		  AND index_class.relname = 'orders_submission_id_unique'
		  AND index_data.indrelid = 'public.orders'::regclass
		  AND index_data.indisunique
		  AND index_data.indisvalid
		  AND index_data.indisready
		  AND index_data.indimmediate
		  AND index_data.indpred IS NULL
		  AND index_data.indexprs IS NULL
		  AND index_data.indnkeyatts = 1
		  AND index_data.indnatts = 1
		  AND attribute.attname = 'submissionId'
		  AND pg_get_indexdef(index_data.indexrelid) =
		      'CREATE UNIQUE INDEX orders_submission_id_unique ON public.orders USING btree ("submissionId")'
	) THEN
		RAISE EXCEPTION 'CUTOVER: orders_submission_id_unique has an unexpected definition.';
	END IF;
END
$$;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "submissionId" varchar(255);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "requestFingerprint" varchar(64);
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS "baseDessertName" varchar(255);
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS "inventoryDeducted" boolean;
ALTER TABLE public.order_item_modifiers ADD COLUMN IF NOT EXISTS "dessertName" varchar(255);

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM pg_constraint constraint_data
		JOIN pg_class table_class ON table_class.oid = constraint_data.conrelid
		JOIN pg_namespace namespace ON namespace.oid = table_class.relnamespace
		JOIN LATERAL unnest(constraint_data.conkey) AS key_column(attnum) ON true
		JOIN pg_attribute attribute
		  ON attribute.attrelid = table_class.oid AND attribute.attnum = key_column.attnum
		WHERE namespace.nspname = 'public'
		  AND (table_class.relname, attribute.attname) IN (
		    ('orders', 'submissionId'),
		    ('orders', 'requestFingerprint'),
		    ('order_items', 'baseDessertName'),
		    ('order_items', 'inventoryDeducted'),
		    ('order_item_modifiers', 'dessertName')
		  )
	) THEN
		RAISE EXCEPTION 'CUTOVER: unexpected constraints reference cutover columns.';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM pg_index index_data
		JOIN pg_class index_class ON index_class.oid = index_data.indexrelid
		JOIN pg_class table_class ON table_class.oid = index_data.indrelid
		JOIN pg_namespace namespace ON namespace.oid = table_class.relnamespace
		WHERE namespace.nspname = 'public'
		  AND table_class.relname IN ('orders', 'order_items', 'order_item_modifiers')
		  AND NOT (table_class.relname = 'orders' AND index_class.relname = 'orders_submission_id_unique')
		  AND (
		    index_data.indexprs IS NOT NULL
		    OR EXISTS (
		      SELECT 1
		      FROM unnest(index_data.indkey) AS key_column(attnum)
		      JOIN pg_attribute attribute
		        ON attribute.attrelid = table_class.oid AND attribute.attnum = key_column.attnum
		      WHERE (table_class.relname, attribute.attname) IN (
		        ('orders', 'submissionId'),
		        ('orders', 'requestFingerprint'),
		        ('order_items', 'baseDessertName'),
		        ('order_items', 'inventoryDeducted'),
		        ('order_item_modifiers', 'dessertName')
		      )
		    )
		  )
	) THEN
		RAISE EXCEPTION 'CUTOVER: unexpected indexes reference cutover columns.';
	END IF;

	IF EXISTS (
		SELECT 1 FROM public.order_items item
		WHERE NOT EXISTS (SELECT 1 FROM public.orders parent WHERE parent.id = item."orderId")
	) THEN
		RAISE EXCEPTION 'CUTOVER: order items without orders must be resolved.';
	END IF;

	IF EXISTS (
		SELECT 1 FROM public.order_items item
		WHERE NOT EXISTS (SELECT 1 FROM public.desserts dessert WHERE dessert.id = item."dessertId")
	) THEN
		RAISE EXCEPTION 'CUTOVER: order items without desserts must be resolved.';
	END IF;

	IF EXISTS (
		SELECT 1 FROM public.order_item_modifiers modifier
		WHERE NOT EXISTS (SELECT 1 FROM public.order_items item WHERE item.id = modifier."orderItemId")
	) THEN
		RAISE EXCEPTION 'CUTOVER: modifiers without order items must be resolved.';
	END IF;

	IF EXISTS (
		SELECT 1 FROM public.order_item_modifiers modifier
		WHERE NOT EXISTS (SELECT 1 FROM public.desserts dessert WHERE dessert.id = modifier."dessertId")
	) THEN
		RAISE EXCEPTION 'CUTOVER: modifiers without desserts must be resolved.';
	END IF;

	IF EXISTS (
		SELECT 1 FROM public.orders
		WHERE ((
			("submissionId" IS NULL AND "requestFingerprint" IS NULL)
			OR ("submissionId" = 'legacy-order:' || id::text
			    AND "requestFingerprint" = 'legacy-order:' || id::text)
			OR ("submissionId" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
			    AND "requestFingerprint" ~ '^[0-9a-f]{64}$')
		)) IS NOT TRUE
	) THEN
		RAISE EXCEPTION 'CUTOVER: invalid or incomplete identity pairs must be resolved.';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM public.orders
		GROUP BY COALESCE("submissionId", 'legacy-order:' || id::text)
		HAVING count(*) > 1
	) THEN
		RAISE EXCEPTION 'CUTOVER: prospective duplicate submission IDs must be resolved.';
	END IF;

	IF EXISTS (
		SELECT 1 FROM public.orders
		WHERE length(COALESCE("submissionId", 'legacy-order:' || id::text)) > 255
		   OR length(COALESCE("requestFingerprint", 'legacy-order:' || id::text)) > 64
	) THEN
		RAISE EXCEPTION 'CUTOVER: prospective identity values exceed their column limits.';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM public.inventory_audit_log audit
		WHERE audit.action = 'order_deducted'
		  AND audit."orderId" IS NOT NULL
		  AND audit."dessertId" IS NOT NULL
		GROUP BY audit."orderId", audit."dessertId"
		HAVING count(*) > 1
	) THEN
		RAISE EXCEPTION 'CUTOVER: duplicate deduction-audit pairs must be resolved.';
	END IF;

	IF EXISTS (
		SELECT 1 FROM public.inventory_audit_log audit
		WHERE audit.action = 'order_deducted'
		  AND audit."orderId" IS NOT NULL
		  AND (audit."dessertId" IS NULL
		       OR audit."previousQuantity" IS NULL OR audit."newQuantity" IS NULL
		       OR audit."previousQuantity" < 0 OR audit."newQuantity" < 0
		       OR audit."previousQuantity" <= audit."newQuantity"
		       OR NOT EXISTS (SELECT 1 FROM public.orders parent WHERE parent.id = audit."orderId"))
	) THEN
		RAISE EXCEPTION 'CUTOVER: invalid deduction audits must be resolved.';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM public.inventory_audit_log audit
		JOIN public.orders parent ON parent.id = audit."orderId"
		WHERE audit.action = 'order_deducted'
		  AND audit.day IS DISTINCT FROM date_trunc('day', parent."createdAt" + interval '5 hours 30 minutes')
	) THEN
		RAISE EXCEPTION 'CUTOVER: deduction-audit operating days must be resolved.';
	END IF;

	IF EXISTS (
		SELECT 1 FROM public.inventory_audit_log audit
		WHERE audit.action = 'order_deducted'
		  AND audit."orderId" IS NOT NULL
		  AND audit."dessertId" IS NOT NULL
		  AND audit."previousQuantity" > audit."newQuantity"
		  AND audit."previousQuantity" >= 0
		  AND audit."newQuantity" >= 0
		  AND NOT EXISTS (
			SELECT 1 FROM public.order_items item
			WHERE item."orderId" = audit."orderId" AND item."dessertId" = audit."dessertId"
		  )
	) THEN
		RAISE EXCEPTION 'CUTOVER: positive deduction audits without matching order items must be resolved.';
	END IF;

	IF EXISTS (
		SELECT 1 FROM public.order_items item
		WHERE item."inventoryDeducted" IS NOT NULL
		  AND item."inventoryDeducted" IS DISTINCT FROM EXISTS (
			SELECT 1
			FROM public.inventory_audit_log audit
			JOIN public.orders parent ON parent.id = audit."orderId"
			WHERE audit.action = 'order_deducted'
			  AND parent.id = item."orderId"
			  AND audit."dessertId" = item."dessertId"
			  AND audit."previousQuantity" > audit."newQuantity"
			  AND audit."previousQuantity" >= 0
			  AND audit."newQuantity" >= 0
			  AND audit.day = date_trunc('day', parent."createdAt" + interval '5 hours 30 minutes')
		  )
	) THEN
		RAISE EXCEPTION 'CUTOVER: populated inventory flags contradict deduction evidence.';
	END IF;
END
$$;

UPDATE public.orders
SET "submissionId" = 'legacy-order:' || id::text,
    "requestFingerprint" = 'legacy-order:' || id::text
WHERE "submissionId" IS NULL
  AND "requestFingerprint" IS NULL;

UPDATE public.order_items item
SET "baseDessertName" = dessert.name
FROM public.desserts dessert
WHERE item."baseDessertName" IS NULL
  AND dessert.id = item."dessertId";

UPDATE public.order_item_modifiers modifier
SET "dessertName" = dessert.name
FROM public.desserts dessert
WHERE modifier."dessertName" IS NULL
  AND dessert.id = modifier."dessertId";

UPDATE public.order_items item
SET "inventoryDeducted" = EXISTS (
	SELECT 1 FROM public.inventory_audit_log audit
	WHERE audit.action = 'order_deducted'
	  AND audit."orderId" = item."orderId"
	  AND audit."dessertId" = item."dessertId"
	  AND audit."previousQuantity" > audit."newQuantity"
	  AND audit."previousQuantity" >= 0
	  AND audit."newQuantity" >= 0
)
WHERE item."inventoryDeducted" IS NULL;

DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM public.orders WHERE "submissionId" IS NULL OR "requestFingerprint" IS NULL)
		OR EXISTS (
			SELECT 1 FROM public.order_items
			WHERE "baseDessertName" IS NULL OR "inventoryDeducted" IS NULL
		)
		OR EXISTS (SELECT 1 FROM public.order_item_modifiers WHERE "dessertName" IS NULL) THEN
		RAISE EXCEPTION 'CUTOVER: backfill left required values null.';
	END IF;

	IF EXISTS (
		SELECT 1 FROM public.orders GROUP BY "submissionId" HAVING count(*) > 1
	) THEN
		RAISE EXCEPTION 'CUTOVER: submission IDs are not unique after backfill.';
	END IF;

	IF EXISTS (
		SELECT 1 FROM public.order_items item
		WHERE item."inventoryDeducted" IS DISTINCT FROM EXISTS (
			SELECT 1
			FROM public.inventory_audit_log audit
			JOIN public.orders parent ON parent.id = audit."orderId"
			WHERE audit.action = 'order_deducted'
			  AND parent.id = item."orderId"
			  AND audit."dessertId" = item."dessertId"
			  AND audit."previousQuantity" > audit."newQuantity"
			  AND audit."previousQuantity" >= 0
			  AND audit."newQuantity" >= 0
			  AND audit.day = date_trunc('day', parent."createdAt" + interval '5 hours 30 minutes')
		)
	) THEN
		RAISE EXCEPTION 'CUTOVER: inventory flags do not match deduction evidence.';
	END IF;
END
$$;

ALTER TABLE public.orders ALTER COLUMN "submissionId" SET NOT NULL;
ALTER TABLE public.orders ALTER COLUMN "requestFingerprint" SET NOT NULL;
ALTER TABLE public.order_items ALTER COLUMN "baseDessertName" SET NOT NULL;
ALTER TABLE public.order_items ALTER COLUMN "inventoryDeducted" SET NOT NULL;
ALTER TABLE public.order_item_modifiers ALTER COLUMN "dessertName" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_submission_id_unique
ON public.orders USING btree ("submissionId");

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_class index_class
		JOIN pg_namespace namespace ON namespace.oid = index_class.relnamespace
		JOIN pg_index index_data ON index_data.indexrelid = index_class.oid
		JOIN pg_attribute attribute
		  ON attribute.attrelid = index_data.indrelid
		 AND attribute.attnum = index_data.indkey[0]
		WHERE namespace.nspname = 'public'
		  AND index_class.relname = 'orders_submission_id_unique'
		  AND index_data.indrelid = 'public.orders'::regclass
		  AND index_data.indisunique
		  AND index_data.indisvalid
		  AND index_data.indisready
		  AND index_data.indimmediate
		  AND index_data.indpred IS NULL
		  AND index_data.indexprs IS NULL
		  AND index_data.indnkeyatts = 1
		  AND index_data.indnatts = 1
		  AND attribute.attname = 'submissionId'
		  AND pg_get_indexdef(index_data.indexrelid) =
		      'CREATE UNIQUE INDEX orders_submission_id_unique ON public.orders USING btree ("submissionId")'
	) THEN
		RAISE EXCEPTION 'CUTOVER: final submission index verification failed.';
	END IF;
END
$$;
