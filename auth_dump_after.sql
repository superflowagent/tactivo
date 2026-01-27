SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict J2g7yqsjMfDEYlpcI0rF0BfDxPBJ86vQcbhU5hXGmWM91VZioHNsalZL6HmPYT1

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") VALUES
	('00000000-0000-0000-0000-000000000000', 'c37c6ecc-4e6c-42d2-b063-d9f883927125', 'authenticated', 'authenticated', 'quartdeto@gmail.com', '$2a$10$GesW4FFMrtp3t.VueVCf4uIOxcdcvKcLM8fYIIcb9WskH1t5.sfEq', '2026-01-27 13:55:00.46262+00', NULL, '', NULL, '46c4136842a327f9773ba38d766a176eaac500d313a421dc281dd9c0', '2026-01-27 13:55:10.072239+00', '', '', NULL, NULL, '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', NULL, '2026-01-27 13:55:00.417945+00', '2026-01-27 13:55:10.425757+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'af016a0c-26ff-460c-b203-ce9cc289fc4c', 'authenticated', 'authenticated', 'victor18rp@gmail.com', '$2a$10$9d5POXf0R5p41iL6aIPCBemrhG17a4eLwiPcKfuUFChF2uag4/ImC', '2026-01-27 10:19:55.60936+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-01-27 10:24:50.778763+00', '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', NULL, '2026-01-27 10:19:55.561007+00', '2026-01-27 14:59:22.427093+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") VALUES
	('af016a0c-26ff-460c-b203-ce9cc289fc4c', 'af016a0c-26ff-460c-b203-ce9cc289fc4c', '{"sub": "af016a0c-26ff-460c-b203-ce9cc289fc4c", "email": "victor18rp@gmail.com", "email_verified": false, "phone_verified": false}', 'email', '2026-01-27 10:19:55.566422+00', '2026-01-27 10:19:55.566493+00', '2026-01-27 10:19:55.566493+00', '46060b60-60d3-472c-81d8-f85a405c2842'),
	('c37c6ecc-4e6c-42d2-b063-d9f883927125', 'c37c6ecc-4e6c-42d2-b063-d9f883927125', '{"sub": "c37c6ecc-4e6c-42d2-b063-d9f883927125", "email": "quartdeto@gmail.com", "email_verified": false, "phone_verified": false}', 'email', '2026-01-27 13:55:00.443126+00', '2026-01-27 13:55:00.443185+00', '2026-01-27 13:55:00.443185+00', '98d867d1-a451-4994-adf1-c1f06956b46b');


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."one_time_tokens" ("id", "user_id", "token_type", "token_hash", "relates_to", "created_at", "updated_at") VALUES
	('3fb0680a-238d-40e5-b35e-f7e8598f8f35', 'c37c6ecc-4e6c-42d2-b063-d9f883927125', 'recovery_token', '46c4136842a327f9773ba38d766a176eaac500d313a421dc281dd9c0', 'quartdeto@gmail.com', '2026-01-27 13:55:10.42664', '2026-01-27 13:55:10.42664');


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 398, true);


--
-- PostgreSQL database dump complete
--

-- \unrestrict J2g7yqsjMfDEYlpcI0rF0BfDxPBJ86vQcbhU5hXGmWM91VZioHNsalZL6HmPYT1

RESET ALL;
