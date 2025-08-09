import Documents from "@/components/Documents";

export const dynamic = "force-dynamic";

export default function DashboardPage() { 
    return (
        <div className="h-full max-w-7xl mx-auto">
            <h1 className="text-3xl p-5 bg-gray-100 font-extralight text-indigo-500">
                My Documents
            </h1>

        {/* Document List */}
        <Documents />

        </div>
    );
}