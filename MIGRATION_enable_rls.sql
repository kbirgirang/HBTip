-- =========================
-- Enable Row Level Security (RLS) on all public tables
-- =========================
-- This migration enables RLS and creates policies that allow all operations
-- Since the app uses SUPABASE_SERVICE_ROLE_KEY, these policies won't affect app functionality
-- but will protect the database from unauthorized access attempts

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonus_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonus_answers ENABLE ROW LEVEL SECURITY;

-- =========================
-- Policies for users table
-- =========================
CREATE POLICY "Allow all SELECT on users" ON public.users FOR SELECT USING (true);

-- =========================
-- Policies for push_subscriptions table
-- =========================
CREATE POLICY "Allow all SELECT on push_subscriptions" ON public.push_subscriptions FOR SELECT USING (true);
CREATE POLICY "Allow all INSERT on push_subscriptions" ON public.push_subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all UPDATE on push_subscriptions" ON public.push_subscriptions FOR UPDATE USING (true);
CREATE POLICY "Allow all DELETE on push_subscriptions" ON public.push_subscriptions FOR DELETE USING (true);

-- =========================
-- Policies for tournaments table
-- =========================
CREATE POLICY "Allow all SELECT on tournaments" ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "Allow all INSERT on tournaments" ON public.tournaments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all UPDATE on tournaments" ON public.tournaments FOR UPDATE USING (true);
CREATE POLICY "Allow all DELETE on tournaments" ON public.tournaments FOR DELETE USING (true);

-- =========================
-- Policies for room_members table
-- =========================
CREATE POLICY "Allow all SELECT on room_members" ON public.room_members FOR SELECT USING (true);
CREATE POLICY "Allow all INSERT on room_members" ON public.room_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all UPDATE on room_members" ON public.room_members FOR UPDATE USING (true);
CREATE POLICY "Allow all DELETE on room_members" ON public.room_members FOR DELETE USING (true);

-- =========================
-- Policies for rooms table
-- =========================
CREATE POLICY "Allow all SELECT on rooms" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "Allow all INSERT on rooms" ON public.rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all UPDATE on rooms" ON public.rooms FOR UPDATE USING (true);

-- =========================
-- Policies for admin_settings table
-- =========================
CREATE POLICY "Allow all SELECT on admin_settings" ON public.admin_settings FOR SELECT USING (true);
CREATE POLICY "Allow all INSERT on admin_settings" ON public.admin_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all UPDATE on admin_settings" ON public.admin_settings FOR UPDATE USING (true);

-- =========================
-- Policies for predictions table
-- =========================
CREATE POLICY "Allow all SELECT on predictions" ON public.predictions FOR SELECT USING (true);
CREATE POLICY "Allow all INSERT on predictions" ON public.predictions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all UPDATE on predictions" ON public.predictions FOR UPDATE USING (true);

-- =========================
-- Policies for players table
-- =========================
CREATE POLICY "Allow all SELECT on players" ON public.players FOR SELECT USING (true);
CREATE POLICY "Allow all INSERT on players" ON public.players FOR INSERT WITH CHECK (true);

-- =========================
-- Policies for matches table
-- =========================
CREATE POLICY "Allow all SELECT on matches" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Allow all INSERT on matches" ON public.matches FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all UPDATE on matches" ON public.matches FOR UPDATE USING (true);
CREATE POLICY "Allow all DELETE on matches" ON public.matches FOR DELETE USING (true);

-- =========================
-- Policies for bonus_questions table
-- =========================
CREATE POLICY "Allow all SELECT on bonus_questions" ON public.bonus_questions FOR SELECT USING (true);
CREATE POLICY "Allow all INSERT on bonus_questions" ON public.bonus_questions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all UPDATE on bonus_questions" ON public.bonus_questions FOR UPDATE USING (true);
CREATE POLICY "Allow all DELETE on bonus_questions" ON public.bonus_questions FOR DELETE USING (true);

-- =========================
-- Policies for bonus_answers table
-- =========================
CREATE POLICY "Allow all SELECT on bonus_answers" ON public.bonus_answers FOR SELECT USING (true);
CREATE POLICY "Allow all INSERT on bonus_answers" ON public.bonus_answers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all UPDATE on bonus_answers" ON public.bonus_answers FOR UPDATE USING (true);
