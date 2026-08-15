CREATE TABLE `demo_bookings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`booking_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`company` text NOT NULL,
	`phone` text NOT NULL,
	`language` text NOT NULL,
	`use_case` text NOT NULL,
	`attendees` text,
	`notes` text,
	`demo_date` text NOT NULL,
	`demo_time` text NOT NULL,
	`timezone` text DEFAULT 'Asia/Dubai' NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `demo_bookings_booking_id_unique` ON `demo_bookings` (`booking_id`);