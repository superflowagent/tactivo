-- ARCHIVED: manual fixes (now replaced by idempotent backfill migration 20260122143200_backfill_profiles_user.sql)
UPDATE public.profiles SET "user" = '5e461476-caab-427c-a1c6-94f7b3ae7a8e' WHERE id = '58fec4d5-8689-4790-8feb-0e287f4dfb4b';
UPDATE public.profiles SET "user" = (SELECT id FROM auth.users WHERE email = 'victor18rp@gmail.com' LIMIT 1) WHERE id = 'e86c62eb-d71c-4d71-84f8-aef6891c9102';
UPDATE public.profiles SET "user" = (SELECT id FROM auth.users WHERE email = 'testclient7@example.com' LIMIT 1) WHERE id = 'c0e2d6ee-5882-4798-bbaa-87d143e0a38e';

SELECT id,email,user::text FROM public.profiles WHERE id IN ('e86c62eb-d71c-4d71-84f8-aef6891c9102','58fec4d5-8689-4790-8feb-0e287f4dfb4b','c0e2d6ee-5882-4798-bbaa-87d143e0a38e');
