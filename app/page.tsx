import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import {
  BrainCog,        
  Globe,
  MonitorSmartphone,
  ServerCog,
  Eye,
  Zap,
} from "lucide-react";

type Feature = {
  name: string;
  description: string;
  icon: LucideIcon;
};

const features: Feature[] = [
  {
    name: "Store your PDF Documents",
    description: "Easily upload and manage your PDF documents in one place.",
    icon: Globe,
  },
  {
    name: "Blazing Fast Responses",
    description:
      "Experience Lightning-fast answers to your queries, ensuring you get the information you need instantly.",
    icon: Zap,
  },
  {
    name: "Chat Memorisation",
    description:
      "Our intelligent chatbot remembers previous interactions, providing a seamless and personalized experience.",
    icon: BrainCog, 
  },
  {
    name: "Interactive PDF Viewer",
    description:
      "Engage with your PDFs like never before using our intuitive and interactive viewer.",
    icon: Eye,
  },
  {
    name: "Cloud Backup",
    description:
      "Keep your documents safe and secure with our cloud backup solution.",
    icon: ServerCog,
  },
  {
    name: "Responsive Across Devices",
    description:
      "Access your documents seamlessly across all devices, ensuring you stay productive on the go.",
    icon: MonitorSmartphone,
  },
];

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
              Introducing <span className="font-bold text-indigo-600">Chat with PDF.</span>
              <br />
              <br />
              Upload your document, and our chatbot will answer questions, summarize content,
              and answer all your Qs. Ideal for everyone,{" "}
              <span className="text-indigo-600">Chat with PDF</span>{" "}
              turns static documents into <span className="font-bold">dynamic conversations</span>,
              enhancing productivity 10x fold effortlessly.
            </p>
          </div>
          <Button asChild className="mt-10">
            <Link href="/dashboard">Get Started</Link>
          </Button>
        </div>

        <div className="relative overflow-hidden pt-16">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <Image
              alt="Chat with PDF"
              src="https://i.imgur.com/VciRSTI.jpg"
              width={2432}
              height={1442}
              className="mb-[-0%] rounded-xl shadow-2xl ring-1 ring-gray-900/10"
            />
            <div aria-hidden="true" className="relative">
              <div className="absolute bottom-0 -inset-x-32 bg-gradient-to-t from-white/96 pt-[5%]" />
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-6 lg:px-8 mt-16">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl text-center">
            Features
          </h2>

          <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ name, description, icon: Icon }) => (
              <div key={name} className="relative flex flex-col gap-6 p-6 bg-white rounded-lg shadow-lg">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-indigo-500 text-white">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
                  <p className="text-base text-gray-600">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div> 
    </main>
  );
}
