SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict Abpa00Xwugz6thfzBTe8xB3IcTd2UfjRAPj0EAGxWCVdiBwzJLGFireb2l5gcZA

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
-- Data for Name: companies; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."companies" ("id", "name", "max_class_assistants", "class_block_mins", "class_unenroll_mins", "logo_path", "open_time", "close_time", "default_appointment_duration", "default_class_duration", "domain", "created") VALUES
	('c421ae9f-1574-409a-8b84-24652e1a01f0', 'AlphaTest', 5, 720, 120, '', '07:00:00', '19:00:00', 60, 90, 'alphatest', '2026-01-27 10:19:55.423868'),
	('f2d38416-ff97-40cd-a3db-58efae969ec5', 'TestBeta', 5, 720, 120, '', '07:00:00', '19:00:00', 60, 90, 'testbeta', '2026-01-27 15:00:15.047886'),
	('b37f3e46-06b6-4bb3-91a6-1f618eb2d690', 'TestBeta', 5, 720, 120, '', '07:00:00', '19:00:00', 60, 90, 'testbeta-1', '2026-01-27 15:00:45.175947'),
	('0a7340af-1ba5-4bb2-af75-937822f4e03d', 'TestBeta', 5, 720, 120, '', '07:00:00', '19:00:00', 60, 90, 'testbeta-2', '2026-01-27 15:00:48.823664'),
	('2d06cf0a-05a3-4e70-a2d6-9a5389bd9040', 'testbeta', 5, 720, 120, '', '07:00:00', '19:00:00', 60, 90, 'testbeta-3', '2026-01-27 15:01:01.730075'),
	('252f7e83-866f-47db-b1f5-104355d2814f', '123', 5, 720, 120, '', '07:00:00', '19:00:00', 60, 90, '123', '2026-01-27 15:03:04.338477');


--
-- Data for Name: anatomy; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: classes_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: equipment; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: events; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: exercises; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."profiles" ("id", "name", "created", "company", "photo_path", "last_name", "dni", "phone", "birth_date", "role", "address", "occupation", "sport", "session_credits", "class_credits", "history", "diagnosis", "notes", "allergies", "user", "invite_token", "invite_expires_at", "email") VALUES
	('6cf245b6-6fa8-4033-a793-b68e970eb8c9', 'Vic', NULL, 'c421ae9f-1574-409a-8b84-24652e1a01f0', NULL, 'Tor', NULL, '123', NULL, 'professional', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'af016a0c-26ff-460c-b203-ce9cc289fc4c', NULL, NULL, 'victor18rp@gmail.com'),
	('37ad3de9-0146-4b60-b97c-1bfc63ad2f66', 'Gaspar', NULL, 'c421ae9f-1574-409a-8b84-24652e1a01f0', '1769522098504-370fec94-d36b-4c63-977f-9336b6b6aa9c.jpg', 'Romero', '123A', '678678678', NULL, 'client', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'c37c6ecc-4e6c-42d2-b063-d9f883927125', 'b8209ef6-1452-4f45-be69-79a69ada17c5', '2026-02-03 13:55:09.962', 'quartdeto@gmail.com');


--
-- Data for Name: programs; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."programs" ("id", "name", "created", "company", "profile", "description", "position") VALUES
	('219d36e1-a02d-4581-8584-ca8fb7a25ba1', 'Programa 1', NULL, 'c421ae9f-1574-409a-8b84-24652e1a01f0', '37ad3de9-0146-4b60-b97c-1bfc63ad2f66', '', NULL);


--
-- Data for Name: program_exercises; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- PostgreSQL database dump complete
--

-- \unrestrict Abpa00Xwugz6thfzBTe8xB3IcTd2UfjRAPj0EAGxWCVdiBwzJLGFireb2l5gcZA

RESET ALL;
