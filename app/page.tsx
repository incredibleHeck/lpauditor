import { redirect } from "next/navigation";
import { createClient } from "@/lib/server";
import { getUserSubmissions } from "@/app/actions/submissions";
import DashboardPageContent from "@/components/DashboardPageContent";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  
  // 1. Authenticate user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/auth/login");
  }

  // 2. Fetch User Profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, department")
    .eq("id", user.id)
    .single();

  // Handle fallback profile if user has auth account but no public profile record yet
  const normalizedProfile = profile || {
    full_name: user.email?.split("@")[0] || "Teacher Account",
    role: "TEACHER",
    department: "Science"
  };

  // 3. Fetch User Submissions
  const submissionsRes = await getUserSubmissions(user.id);
  const initialSubmissions = submissionsRes.data || [];

  return (
    <DashboardPageContent
      initialSubmissions={initialSubmissions as any}
      teacherId={user.id}
      profile={normalizedProfile}
    />
  );
}
