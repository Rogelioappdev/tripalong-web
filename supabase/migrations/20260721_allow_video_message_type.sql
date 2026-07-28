-- messages/trip_messages.type check constraints predate video support and
-- silently reject video sends at the DB layer (uncaught insert error after
-- the storage upload already succeeded).
alter table messages drop constraint messages_type_check;
alter table messages add constraint messages_type_check
  check (type = any (array['text', 'image', 'video', 'system']));

alter table trip_messages drop constraint trip_messages_type_check;
alter table trip_messages add constraint trip_messages_type_check
  check (type = any (array['text', 'image', 'video', 'system']));
