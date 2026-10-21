# BeMove

Clean, white-and-red Expo fitness tracker for meals, calories, hybrid/MMA workouts, and weight progress toward 115 kg.

## Run locally

1. Install Node.js and dependencies with `npm install`.
2. Copy `.env.example` to `.env` and add your Supabase project URL and **publishable/anon key**.
3. In the Supabase SQL editor, run [`supabase/schema.sql`](./supabase/schema.sql).
4. Enable email authentication and **Allow anonymous sign-ins** in Supabase Authentication settings, then start the app with `npx expo start`.

Never put a Supabase `service_role` key or personal access token in a mobile app. Expo public environment variables are bundled into the client; use only the project's publishable/anon key. Database row-level security keeps each authenticated user's fitness data private.

Users can enter through the guest option and later add an email and password from their profile. Guest records are attached to the anonymous Supabase user and remain available when that same account is upgraded; signing out before upgrading can make the temporary account difficult to recover.

## Included

- Expo Router screens: dashboard, meals/favorites, hybrid/MMA workouts, and weight history.
- Sleep logging with duration, quality, notes, and daily history at `/sleep`; sleep entries also appear in the calendar.
- Body measurements for waist, arms, chest, hips, and thighs at `/measurements`, linked from the weight screen and calendar.
- Meal and workout entries store their exact time in `created_at`; users can set the time on entry and adjust it in history.
- Workouts can include named exercises and per-set weight/repetition details; apply `supabase/migrations/20261021165000_workout_exercise_details.sql` to upgrade existing databases.
- Daily step tracking via the native Expo Pedometer on iOS, with Supabase sync and manual entry when a sensor is unavailable.
- Supabase email sign-up/sign-in and anonymous guest sessions, persistent device and web/PWA sessions using AsyncStorage, and per-user row-level security.
- Meal photo analysis uses the Gemini Interactions API with `gemini-3.8-flash`; set `GEMINI_API_KEY` as a Supabase Edge Function secret before deploying `analyze-meal`.
- NativeWind styling, reusable UI components, Lucide icons, and an SVG weight trend chart.
- Initial target of 115 kg; calorie goal defaults to 2,200 kcal. Workout calorie burn is an estimate based on workout category and duration, not a medical or physiological measurement.

## Database migrations

Run the SQL in `supabase/migrations/20261020212000_sleep_logs.sql` in the Supabase SQL Editor to add sleep tracking with per-user row-level security. The full schema in `supabase/schema.sql` also includes this table and policy.

Run `supabase/migrations/20261020213000_calendar_and_steps_compat.sql` for the calendar tables/columns and daily step logs with per-user RLS. Native iOS motion permission text is configured through the `expo-sensors` config plugin. Expo Pedometer reads Core Motion step data; it is not a HealthKit import. Reading Apple Health records themselves requires a separate HealthKit native integration and an iOS development build.

Run `supabase/migrations/20261020214000_body_measurements.sql` to add body circumference history and per-user RLS. To deploy the meal analysis function after logging in and linking the project, run `npx supabase functions deploy analyze-meal --project-ref <project-ref>`; leave JWT verification enabled so the Gemini-backed function is not exposed as an unauthenticated public endpoint.

Run `supabase/migrations/20261021164300_meal_workout_timestamps.sql` to ensure meals and workouts have a non-null `created_at` timestamp with a `now()` default.
