-- Allow video uploads in the chat-images bucket (used for both chat and DM media).
-- Client already supports sending video/mp4, video/quicktime, video/webm up to 50MB.
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm'],
    file_size_limit = 52428800
where id = 'chat-images';
