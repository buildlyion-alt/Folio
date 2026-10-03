CREATE TYPE "public"."member_role" AS ENUM('owner', 'educator');--> statement-breakpoint
CREATE TYPE "public"."pace_status" AS ENUM('not_started', 'active', 'completed');--> statement-breakpoint
CREATE TYPE "public"."progress_event_kind" AS ENUM('started', 'completed', 'updated', 'reopened', 'reset', 'removed');--> statement-breakpoint
CREATE TYPE "public"."progress_source" AS ENUM('manual', 'assistant', 'onboarding', 'demo');--> statement-breakpoint
CREATE TABLE "academic_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "academic_terms_dates_ordered" CHECK ("academic_terms"."ends_on" >= "academic_terms"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "household_members" (
	"household_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" DEFAULT 'owner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "household_members_household_id_user_id_pk" PRIMARY KEY("household_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "households" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"pass_mark" smallint DEFAULT 80 NOT NULL,
	"paces_per_year" smallint DEFAULT 12 NOT NULL,
	"school_year_start" date,
	"is_demo" boolean DEFAULT false NOT NULL,
	"onboarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "households_pass_mark_range" CHECK ("households"."pass_mark" between 50 and 100),
	CONSTRAINT "households_paces_per_year_range" CHECK ("households"."paces_per_year" between 1 and 60)
);
--> statement-breakpoint
CREATE TABLE "pace_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"student_subject_id" uuid NOT NULL,
	"pace_number" smallint NOT NULL,
	"status" "pace_status" NOT NULL,
	"started_on" date,
	"completed_on" date,
	"test_score" smallint,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pace_records_enrollment_pace_unique" UNIQUE("student_subject_id","pace_number"),
	CONSTRAINT "pace_records_pace_number_range" CHECK ("pace_records"."pace_number" between 1 and 9999),
	CONSTRAINT "pace_records_score_range" CHECK ("pace_records"."test_score" is null or "pace_records"."test_score" between 0 and 100),
	CONSTRAINT "pace_records_completed_has_date" CHECK (("pace_records"."status" = 'completed') = ("pace_records"."completed_on" is not null)),
	CONSTRAINT "pace_records_score_only_when_completed" CHECK ("pace_records"."test_score" is null or "pace_records"."status" = 'completed'),
	CONSTRAINT "pace_records_not_started_has_no_start" CHECK ("pace_records"."status" <> 'not_started' or "pace_records"."started_on" is null),
	CONSTRAINT "pace_records_dates_ordered" CHECK ("pace_records"."started_on" is null or "pace_records"."completed_on" is null or "pace_records"."completed_on" >= "pace_records"."started_on")
);
--> statement-breakpoint
CREATE TABLE "progress_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"student_subject_id" uuid NOT NULL,
	"pace_record_id" uuid,
	"pace_number" smallint NOT NULL,
	"kind" "progress_event_kind" NOT NULL,
	"status" "pace_status",
	"test_score" smallint,
	"occurred_on" date NOT NULL,
	"source" "progress_source" NOT NULL,
	"actor_user_id" uuid,
	"previous" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_subjects_student_subject_unique" UNIQUE("student_id","subject_id"),
	CONSTRAINT "student_subjects_id_household_unique" UNIQUE("id","household_id")
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text,
	"level" smallint,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "students_id_household_unique" UNIQUE("id","household_id"),
	CONSTRAINT "students_level_range" CHECK ("students"."level" is null or "students"."level" between 1 and 12)
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subjects_id_household_unique" UNIQUE("id","household_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "academic_terms" ADD CONSTRAINT "academic_terms_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pace_records" ADD CONSTRAINT "pace_records_enrollment_fk" FOREIGN KEY ("student_subject_id","household_id") REFERENCES "public"."student_subjects"("id","household_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_events" ADD CONSTRAINT "progress_events_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_events" ADD CONSTRAINT "progress_events_pace_record_id_pace_records_id_fk" FOREIGN KEY ("pace_record_id") REFERENCES "public"."pace_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_events" ADD CONSTRAINT "progress_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_events" ADD CONSTRAINT "progress_events_enrollment_fk" FOREIGN KEY ("student_subject_id","household_id") REFERENCES "public"."student_subjects"("id","household_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_subjects" ADD CONSTRAINT "student_subjects_student_fk" FOREIGN KEY ("student_id","household_id") REFERENCES "public"."students"("id","household_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_subjects" ADD CONSTRAINT "student_subjects_subject_fk" FOREIGN KEY ("subject_id","household_id") REFERENCES "public"."subjects"("id","household_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "academic_terms_household_idx" ON "academic_terms" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "household_members_user_idx" ON "household_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pace_records_household_status_idx" ON "pace_records" USING btree ("household_id","status");--> statement-breakpoint
CREATE INDEX "pace_records_household_completed_idx" ON "pace_records" USING btree ("household_id","completed_on");--> statement-breakpoint
CREATE INDEX "progress_events_household_created_idx" ON "progress_events" USING btree ("household_id","created_at");--> statement-breakpoint
CREATE INDEX "progress_events_record_idx" ON "progress_events" USING btree ("pace_record_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "student_subjects_household_idx" ON "student_subjects" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "students_household_idx" ON "students" USING btree ("household_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subjects_household_name_idx" ON "subjects" USING btree ("household_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_idx" ON "users" USING btree (lower("email"));