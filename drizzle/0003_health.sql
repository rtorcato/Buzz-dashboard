CREATE TABLE "agent_events" (
	"id" text PRIMARY KEY NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"agent" text NOT NULL,
	"model" text NOT NULL,
	"kind" text NOT NULL,
	"reason" text,
	"status" integer
);
--> statement-breakpoint
CREATE INDEX "agent_events_at_idx" ON "agent_events" USING btree ("at");