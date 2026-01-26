-- =========================
-- Migration: Improve Query Performance v2
-- =========================
-- Byggir á pg_stat_statements / Supabase query stats.
-- Bætir covering vísitölur (INCLUDE) til að gera index-only scans og minnka
-- heap access fyrir algengar SELECT fyrirspurnir.
--
-- ÖRUGGT: Bætir eingöngu vísitölum. Breytir ekki gögnum né töflum.
--
-- Áhrif (viðeigandi fyrirspurnir):
-- - predictions WHERE member_id = ANY($1): minni mean_time (index-only mögulegt)
-- - bonus_answers WHERE member_id + question_id / room_id + question_id: sama
--

-- 1) Predictions: covering fyrir view/leaderboard – member_id lookup
-- Fyrirspurn: SELECT member_id, match_id, pick, room_id FROM predictions WHERE member_id = ANY($1)
-- Núverandi idx_predictions_member og idx_predictions_member_room ná ekki yfir öll dálk.
-- Þetta gerir index-only scan mögulegt.
CREATE INDEX IF NOT EXISTS idx_predictions_member_covering
ON public.predictions(member_id) INCLUDE (match_id, pick, room_id);

-- 2) Bonus answers: covering fyrir member_id + question_id lookup
-- Fyrirspurn: ... WHERE member_id = ANY($1) AND question_id = ANY($2)
-- Dálkar: member_id, question_id, answer_number, answer_choice, answer_player_id, room_id
CREATE INDEX IF NOT EXISTS idx_bonus_answers_member_question_covering
ON public.bonus_answers(member_id, question_id)
INCLUDE (answer_number, answer_choice, answer_player_id, room_id);

-- 3) Bonus answers: covering fyrir room_id + question_id lookup
-- Fyrirspurn: ... WHERE room_id = $1 AND question_id = ANY($2)
-- (Notað ef einhverjar per-room bonus fyrirspurnir eru enn til)
CREATE INDEX IF NOT EXISTS idx_bonus_answers_room_question_covering
ON public.bonus_answers(room_id, question_id)
INCLUDE (member_id, answer_number, answer_choice, answer_player_id);

-- Reload PostgREST schema (fyrir Supabase)
NOTIFY pgrst, 'reload schema';
