CREATE TABLE "cost_points" (
	"at" timestamp with time zone NOT NULL,
	"agent" text NOT NULL,
	"model" text NOT NULL,
	"metric" text NOT NULL,
	"type" text NOT NULL,
	"series" text NOT NULL,
	"value" double precision NOT NULL,
	CONSTRAINT "cost_points_agent_series_model_metric_type_at_pk" PRIMARY KEY("agent","series","model","metric","type","at")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "cost_points_at_idx" ON "cost_points" USING btree ("at");