import "server-only";

import mongoose from "mongoose";
import connectToDatabase from "@/lib/config/mongodb";
import { DocumentModel } from "@/lib/models";

type CleanupParams = {
  documentId: string;
  gridFsId?: string | null;
};

type CleanupResult = {
  documentDeleted: boolean;
  gridFsDeleted: boolean;
};

export async function purgeBlockedDocument(
  params: CleanupParams
): Promise<CleanupResult> {
  const { documentId, gridFsId } = params;

  await connectToDatabase();
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("MongoDB connection not ready");
  }

  let gridFsDeleted = false;
  if (gridFsId) {
    try {
      const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: "uploads" });
      const fileObjectId = new mongoose.Types.ObjectId(gridFsId);
      await bucket.delete(fileObjectId);
      gridFsDeleted = true;
    } catch (error) {
      console.warn("Failed to delete GridFS file:", error);
    }
  }

  let documentDeleted = false;
  try {
    const result = await DocumentModel.deleteOne({ _id: documentId });
    documentDeleted = (result?.deletedCount ?? 0) > 0;
  } catch (error) {
    console.warn("Failed to delete document metadata:", error);
  }

  return { documentDeleted, gridFsDeleted };
}
