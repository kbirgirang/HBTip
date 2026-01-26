-- =========================
-- Athuga Database Performance
-- =========================
-- Keyrðu þessa skrá í Supabase SQL Editor til að athuga:
-- 1. Hvort allar vísitölur séu til staðar
-- 2. Stærð á töflum
-- 3. Hvort það séu hægar fyrirspurnir

-- 1) Athuga hvort allar vísitölur séu til staðar
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('predictions', 'bonus_answers', 'room_members', 'matches', 'bonus_questions')
ORDER BY tablename, indexname;

-- 2) Stærð á töflum (til að sjá hvort það séu mörg gögn)
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('predictions', 'bonus_answers', 'room_members', 'matches', 'bonus_questions', 'rooms')
ORDER BY size_bytes DESC;

-- 3) Fjöldi raða í hverri töflu
SELECT 
  'predictions' AS table_name,
  COUNT(*) AS row_count
FROM public.predictions
UNION ALL
SELECT 
  'bonus_answers' AS table_name,
  COUNT(*) AS row_count
FROM public.bonus_answers
UNION ALL
SELECT 
  'room_members' AS table_name,
  COUNT(*) AS row_count
FROM public.room_members
UNION ALL
SELECT 
  'matches' AS table_name,
  COUNT(*) AS row_count
FROM public.matches
UNION ALL
SELECT 
  'bonus_questions' AS table_name,
  COUNT(*) AS row_count
FROM public.bonus_questions
UNION ALL
SELECT 
  'rooms' AS table_name,
  COUNT(*) AS row_count
FROM public.rooms
ORDER BY row_count DESC;

-- 4) Athuga hvort covering indexes séu til staðar (mikilvægt fyrir performance)
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    indexname LIKE '%covering%' OR
    indexname = 'idx_predictions_member_covering' OR
    indexname = 'idx_bonus_answers_member_question_covering' OR
    indexname = 'idx_bonus_answers_room_question_covering'
  )
ORDER BY indexname;

-- 5) Athuga hvort það séu hægar fyrirspurnir (ef pg_stat_statements er virkt)
-- ATHUGIÐ: Þetta virkar aðeins ef pg_stat_statements extension er virkt
SELECT 
  query,
  calls,
  mean_exec_time,
  max_exec_time,
  total_exec_time
FROM pg_stat_statements
WHERE query LIKE '%predictions%' OR query LIKE '%bonus_answers%'
ORDER BY mean_exec_time DESC
LIMIT 10;

-- 6) Athuga hvort það séu "bloated" vísitölur (þarf að keyra VACUUM ANALYZE)
SELECT 
  schemaname,
  relname AS tablename,
  indexrelname AS indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND relname IN ('predictions', 'bonus_answers', 'room_members')
ORDER BY pg_relation_size(indexrelid) DESC;
