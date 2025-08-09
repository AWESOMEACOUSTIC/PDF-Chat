"use client";

import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Button } from "./ui/button";
import { FilePlus2 } from "lucide-react";

export default function Header() {
    return (
        <header className="flex items-center justify-between px-4 py-3 shadow-sm bg-white">
            <Link href="/dashboard" className="text-2xl font-semibold">
                Chat to <span className="text-indigo-600">PDF</span>
            </Link>

            <div className="flex items-center gap-2">

                <Button asChild variant="link" className="hidden md:flex">
                    <Link href="/dashboard/upgrade">Pricing</Link>
                </Button>

                <Button asChild variant="outline">
                    <Link href="/dashboard">My Documents</Link>
                </Button>

                <Button asChild variant="outline" className="border-indigo-600">
                    <Link href="/dashboard/upload">
                        <FilePlus2 className="h-4 w-4 text-indigo-600" />
                    </Link>
                </Button>

                <SignedIn>
                    <UserButton afterSignOutUrl="/" />
                </SignedIn>
                <SignedOut>
                    <SignInButton mode="modal">
                        <Button>Sign in</Button>
                    </SignInButton>
                </SignedOut>
            </div>
        </header>
    );
}
