import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const demoBookings = sqliteTable("demo_bookings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bookingId: text("booking_id").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  company: text("company").notNull(),
  phone: text("phone").notNull(),
  language: text("language").notNull(),
  useCase: text("use_case").notNull(),
  attendees: text("attendees"),
  notes: text("notes"),
  demoDate: text("demo_date").notNull(),
  demoTime: text("demo_time").notNull(),
  timezone: text("timezone").notNull().default("Asia/Dubai"),
  status: text("status").notNull().default("confirmed"),
  createdAt: text("created_at").notNull(),
});
