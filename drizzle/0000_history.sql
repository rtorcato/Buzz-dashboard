CREATE TABLE "events" (
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"kind" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"actor" text,
	"repo" text,
	"channel" text,
	"title" text,
	"url" text,
	"body" text,
	"data" jsonb,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_source_source_id_pk" PRIMARY KEY("source","source_id")
);
--> statement-breakpoint
CREATE INDEX "events_at_idx" ON "events" USING btree ("at");