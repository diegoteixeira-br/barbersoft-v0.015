ALTER TABLE public.business_hours
ADD CONSTRAINT business_hours_user_id_day_of_week_key UNIQUE (user_id, day_of_week);