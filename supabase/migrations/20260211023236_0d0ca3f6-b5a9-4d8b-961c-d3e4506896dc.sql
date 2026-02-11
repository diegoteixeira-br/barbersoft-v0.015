
-- Create demo-audio bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('demo-audio', 'demo-audio', true);

-- Public read access
CREATE POLICY "Anyone can read demo audio"
ON storage.objects FOR SELECT
USING (bucket_id = 'demo-audio');

-- Only service_role can insert
CREATE POLICY "Service role can insert demo audio"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'demo-audio' AND (SELECT current_setting('role')) = 'service_role');

-- Only service_role can update
CREATE POLICY "Service role can update demo audio"
ON storage.objects FOR UPDATE
USING (bucket_id = 'demo-audio' AND (SELECT current_setting('role')) = 'service_role');
