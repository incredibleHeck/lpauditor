import { getUserSubmissions } from "@/app/actions/submissions";
import DashboardPageContent from "@/components/DashboardPageContent";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Fetch initial empty or placeholder submissions for SSR hydration
  const teacherId = ""; // Will be updated on client via Firebase Auth listener
  const submissionsRes = await getUserSubmissions(teacherId);
  const initialSubmissions = submissionsRes.data || [];

  return (
    <DashboardPageContent
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialSubmissions={initialSubmissions as any}
      teacherId={teacherId}
      profile={{
        full_name: "Teacher Portal",
        role: "TEACHER",
        department: "Primary Science"
      }}
    />
  );
}
