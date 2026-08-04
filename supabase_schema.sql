-- 1. Profiles Table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  role TEXT CHECK (role IN ('TEACHER', 'HOD', 'ADMIN')) DEFAULT 'TEACHER',
  department TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Submissions Table
CREATE TABLE submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  week_name TEXT NOT NULL,
  grade_level TEXT NOT NULL,
  file_url TEXT NOT NULL,
  status TEXT CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')) DEFAULT 'PENDING',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. AI Audits Table
CREATE TABLE ai_audits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE UNIQUE,
  score NUMERIC CHECK (score >= 0 AND score <= 100),
  lessons_detected INTEGER,
  strengths JSONB,
  flags JSONB,
  raw_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_audits ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Profiles Policies (Required to allow user creation during signup)
CREATE POLICY "Public profiles are viewable by authenticated users" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Submissions Policies
CREATE POLICY "Teachers can view own submissions" ON submissions
  FOR SELECT USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can insert own submissions" ON submissions
  FOR INSERT WITH CHECK (auth.uid() = teacher_id);

-- AI Audits Policies
CREATE POLICY "Teachers can view own audits" ON ai_audits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM submissions 
      WHERE submissions.id = ai_audits.submission_id 
      AND submissions.teacher_id = auth.uid()
    )
  );

-- 5. HOD Policies
CREATE POLICY "HODs can view department submissions" ON submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'HOD'
      AND profiles.department = submissions.subject
    )
  );

CREATE POLICY "HODs can view department audits" ON ai_audits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM submissions
      JOIN profiles ON profiles.id = auth.uid()
      WHERE submissions.id = ai_audits.submission_id
      AND profiles.role = 'HOD'
      AND profiles.department = submissions.subject
    )
  );

-- 6. Auth Trigger for automatic profile creation
-- Note: SECURITY DEFINER runs with database owner privileges to write into public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, department)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'TEACHER'),
    COALESCE(new.raw_user_meta_data->>'department', 'Science')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
