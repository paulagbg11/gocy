import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Attachment, DocumentDetails, DocumentType, TripDocument } from "@/lib/supabase/types";

export function useDocuments(tripId: string) {
  return useQuery({
    queryKey: ["documents", tripId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("trip_id", tripId)
        .order("created_at");
      if (error) throw error;
      return data as TripDocument[];
    },
    enabled: !!tripId,
  });
}

export function useDocument(docId: string) {
  return useQuery({
    queryKey: ["document", docId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("documents").select("*").eq("id", docId).single();
      if (error) throw error;
      return data as TripDocument;
    },
    enabled: !!docId,
  });
}

export function useAttachments(documentId: string) {
  return useQuery({
    queryKey: ["attachments", documentId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("attachments")
        .select("*")
        .eq("document_id", documentId)
        .order("created_at");
      if (error) throw error;
      return data as Attachment[];
    },
    enabled: !!documentId,
  });
}

interface CreateDocumentInput {
  trip_id: string;
  type: DocumentType;
  title: string;
  details: DocumentDetails;
  notes?: string | null;
  place_id?: string | null;
  day_id?: string | null;
  created_by: string | null;
}

export function useCreateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateDocumentInput) => {
      const supabase = createClient();
      const { data, error } = await supabase.from("documents").insert(input).select().single();
      if (error) throw error;
      return data as TripDocument;
    },
    onSuccess: (data) => queryClient.invalidateQueries({ queryKey: ["documents", data.trip_id] }),
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      trip_id,
      ...patch
    }: { id: string; trip_id: string } & Partial<CreateDocumentInput>) => {
      const supabase = createClient();
      const { error } = await supabase.from("documents").update(patch).eq("id", id);
      if (error) throw error;
      return { id, trip_id };
    },
    onSuccess: ({ id, trip_id }) => {
      queryClient.invalidateQueries({ queryKey: ["documents", trip_id] });
      queryClient.invalidateQueries({ queryKey: ["document", id] });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; trip_id: string }) => {
      const supabase = createClient();
      const { error } = await supabase.from("documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, { trip_id }) => queryClient.invalidateQueries({ queryKey: ["documents", trip_id] }),
  });
}

export function useUploadAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      documentId,
      tripId,
      file,
    }: {
      documentId: string;
      tripId: string;
      file: File;
    }) => {
      const supabase = createClient();
      const path = `${tripId}/${documentId}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("trip-attachments").upload(path, file);
      if (uploadError) throw uploadError;
      const { error } = await supabase.from("attachments").insert({
        document_id: documentId,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      });
      if (error) throw error;
    },
    onSuccess: (_data, { documentId }) =>
      queryClient.invalidateQueries({ queryKey: ["attachments", documentId] }),
  });
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, storagePath }: { id: string; documentId: string; storagePath: string }) => {
      const supabase = createClient();
      await supabase.storage.from("trip-attachments").remove([storagePath]);
      const { error } = await supabase.from("attachments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, { documentId }) =>
      queryClient.invalidateQueries({ queryKey: ["attachments", documentId] }),
  });
}
