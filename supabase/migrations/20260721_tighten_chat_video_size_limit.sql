-- Videos aren't compressed yet, so bound worst-case storage/bandwidth per
-- video by matching the bucket cap to the client-side 20MB limit (down from
-- the original 50MB) until real usage data justifies building compression.
update storage.buckets
set file_size_limit = 20971520
where id = 'chat-images';
