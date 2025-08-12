import { NextRequest, NextResponse } from "next/server";

import connectToDatabase from "@/lib/mongodb";

import { DocumentModel } from "@/lib/models";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {

    try {

        // Connect to database

        await connectToDatabase();

        // Get query parameters

        const userId = req.nextUrl.searchParams.get("userId") || "demo-user";

        // Fetch all documents for the user

        const documents = await DocumentModel.find({ userId })

            .sort({ uploadedAt: -1 }) // Sort by most recent first

            .select({

                clientFileId: 1,

                fileName: 1,

                fileSize: 1,

                fileType: 1,

                fileUrl: 1,

                uploadedAt: 1,

                status: 1,

                metadata: 1

            });

        console.log(`Found ${documents.length} documents for user: ${userId}`);

        return NextResponse.json({

            success: true,

            documents: documents.map(doc => ({

                id: doc._id.toString(),

                fileId: doc.clientFileId,

                fileName: doc.fileName,

                fileSize: doc.fileSize,

                fileType: doc.fileType,

                fileUrl: doc.fileUrl,

                uploadedAt: doc.uploadedAt,

                status: doc.status,

                gridFsId: doc.metadata.gridFsId

            }))

        });

    } catch (error) {

        console.error("Error fetching documents:", error);

        return NextResponse.json(

            {

                success: false,

                message: "Failed to fetch documents",

                error: error instanceof Error ? error.message : "Unknown error"

            },

            { status: 500 }

        );

    }

}