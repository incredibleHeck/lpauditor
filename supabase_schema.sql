-- 1. Profiles Table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  role TEXT CHECK (role IN ('TEACHER', 'HOD', 'ADMIN')),
  department_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Submissions Table
CREATE TABLE submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  subject_id TEXT,
  gcs_uri TEXT,
  status TEXT CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')) DEFAULT 'PENDING',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. AI Audits Table
CREATE TABLE ai_audits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID REFERENCES submissions ON DELETE CASCADE,
  compliance_score NUMERIC,
  audit_payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_audits ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies (Teachers)
CREATE POLICY "Teachers can view own submissions" ON submissions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Teachers can insert own submissions" ON submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Teachers can view own audits" ON ai_audits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM submissions 
      WHERE submissions.id = ai_audits.submission_id 
      AND submissions.user_id = auth.uid()
    )
  );
