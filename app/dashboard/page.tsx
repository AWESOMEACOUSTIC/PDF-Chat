import { currentUser } from "@clerk/nextjs/server";

export default async function DashboardPage() {
  const user = await currentUser();

  return (
    <main className="h-full w-full p-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Welcome{user?.firstName ? `, ${user.firstName}` : ""}.
        </p>
        <div className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
          <p className="text-gray-700">This is your starting point. Build your PDF chat experience here.</p>
        </div>
      </div>
    </main>
  );
}
