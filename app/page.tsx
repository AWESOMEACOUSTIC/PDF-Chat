import {Button} from "@/components/ui/button";
import Link from "next/link";
import {
  BrainCogIcon,
  GlobeIcon,
  MonitorSmartphoneIcon,
  ServerCogIcon,
  EyeIcon,
  ZapIcon,
} from "lucide-react";

const features = [
  {
    name: "Store your PDF Documents",
    description: "Easily upload and manage your PDF documents in one place.",
    icons: GlobeIcon
  },
  {
    "name": "Blazing Fast Responses",
    "description": "Experience Lightning-fast answers to your queries, ensuring you get the information you need instantly.",
    "icon": ZapIcon
  },
  {
    "name": "Chat Memorisation",
    "description": "Our intelligent chatbot remembers previous interactions, providing a seamless and personalized experience.",
    "icon": BrainCogIcon
  },
  {
    "name": "Interactive PDF Viewer",
    "description": "Engage with your PDFs like never before using our intuitive and interactive viewer.",
    "icon": EyeIcon
  },
  {
    "name": "Cloud Backup",
    "description": "Keep your documents safe and secure with our cloud backup solution.",
    "icon": ServerCogIcon
  },
  {
    "name": "Responsive Across Devices",
    "description": "Access your documents seamlessly across all devices, ensuring you stay productive on the go.",
    "icon": MonitorSmartphoneIcon
  }
]

export default function Home() {
  return (
    <main className="flex-1 overflow-scroll p-2 lg:p-5 bg-gradient-to-bl from-white to-indigo-600">
      <div className="bg-white py-24 sm:py-32 rounded-md drop-shadow-xl">
        <div className="flex flex-col justify-center items-center mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl sm:text-center">
            <h2 className="text-base font-semibold leading-7 text-indigo-600">
              Your Interactive Document Companion
            </h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              Transform Your PDFs into Interactive Conversations
            </p>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Introducing{" "}
              <span className="font-bold text-indigo-600">Chat with PDF.</span>
              <br />
              <br />
              Upload your document, and our chatbot will answer
              questions, summarize content, and answer all your Qs. Ideal for
              everyone, <span className="text-indigo-600">
                Chat with PDF
              </span>{" "}
              turns static documents into{" "}
              <span className="font-bold">dynamic conversations</span>,
              enhancing productivity 10x fold effortlessly.
            </p>
          </div>
          <Button asChild className="mt-10">
            <Link href='/dashboard'>Get Started</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
