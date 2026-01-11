/**
 * Photo Upload Hook
 *
 * Handles uploading photos to Supabase Storage
 */

import { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '@/api/supabase/client';
import { useAuthStore } from '@/stores/authStore';

interface UploadProgress {
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
  url?: string;
}

interface UsePhotoUploadReturn {
  pickAndUploadPhoto: () => Promise<string | null>;
  uploadPhoto: (uri: string) => Promise<string | null>;
  uploadMultiplePhotos: (uris: string[]) => Promise<UploadProgress[]>;
  isUploading: boolean;
  progress: UploadProgress[];
  deletePhoto: (photoUrl: string) => Promise<boolean>;
}

const BUCKET_NAME = 'user-photos';
const MAX_IMAGE_SIZE = 1024; // Max dimension
const JPEG_QUALITY = 0.8;

/**
 * Compress and resize image before upload
 */
async function processImage(uri: string): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [
        {
          resize: {
            width: MAX_IMAGE_SIZE,
            height: MAX_IMAGE_SIZE,
          },
        },
      ],
      {
        compress: JPEG_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    return result.uri;
  } catch (error) {
    console.error('Error processing image:', error);
    // Return original if processing fails
    return uri;
  }
}

/**
 * Generate a unique file path for the photo
 */
function generateFilePath(userId: string, index: number = 0): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `${userId}/${timestamp}_${index}_${random}.jpg`;
}

/**
 * Convert file URI to Blob for upload
 */
async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return await response.blob();
}

/**
 * Hook for photo upload functionality
 */
export function usePhotoUpload(): UsePhotoUploadReturn {
  const user = useAuthStore((s) => s.user);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress[]>([]);

  /**
   * Pick a photo from library and upload it
   */
  const pickAndUploadPhoto = useCallback(async (): Promise<string | null> => {
    if (!user?.id) {
      console.error('User not authenticated');
      return null;
    }

    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      console.error('Permission not granted');
      return null;
    }

    // Pick image
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4], // Portrait aspect ratio
      quality: 1,
    });

    if (result.canceled || !result.assets[0]) {
      return null;
    }

    return uploadPhoto(result.assets[0].uri);
  }, [user?.id]);

  /**
   * Upload a single photo
   */
  const uploadPhoto = useCallback(
    async (uri: string): Promise<string | null> => {
      if (!user?.id) {
        console.error('User not authenticated');
        return null;
      }

      setIsUploading(true);
      const uploadId = Math.random().toString(36).substring(7);

      setProgress((prev) => [
        ...prev,
        { id: uploadId, progress: 0, status: 'uploading' },
      ]);

      try {
        // Process image
        const processedUri = await processImage(uri);

        setProgress((prev) =>
          prev.map((p) =>
            p.id === uploadId ? { ...p, progress: 30 } : p
          )
        );

        // Convert to blob
        const blob = await uriToBlob(processedUri);

        setProgress((prev) =>
          prev.map((p) =>
            p.id === uploadId ? { ...p, progress: 50 } : p
          )
        );

        // Generate file path
        const filePath = generateFilePath(user.id);

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(filePath, blob, {
            contentType: 'image/jpeg',
            upsert: false,
          });

        if (error) {
          throw error;
        }

        setProgress((prev) =>
          prev.map((p) =>
            p.id === uploadId ? { ...p, progress: 90 } : p
          )
        );

        // Get public URL
        const { data: urlData } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(filePath);

        const publicUrl = urlData.publicUrl;

        setProgress((prev) =>
          prev.map((p) =>
            p.id === uploadId
              ? { ...p, progress: 100, status: 'complete', url: publicUrl }
              : p
          )
        );

        setIsUploading(false);
        return publicUrl;
      } catch (error) {
        console.error('Error uploading photo:', error);

        setProgress((prev) =>
          prev.map((p) =>
            p.id === uploadId
              ? {
                  ...p,
                  status: 'error',
                  error: error instanceof Error ? error.message : 'Upload failed',
                }
              : p
          )
        );

        setIsUploading(false);
        return null;
      }
    },
    [user?.id]
  );

  /**
   * Upload multiple photos in parallel
   */
  const uploadMultiplePhotos = useCallback(
    async (uris: string[]): Promise<UploadProgress[]> => {
      if (!user?.id) {
        console.error('User not authenticated');
        return [];
      }

      setIsUploading(true);

      // Create initial progress entries
      const uploads = uris.map((uri, index) => ({
        id: `${Date.now()}_${index}`,
        uri,
        progress: 0,
        status: 'pending' as const,
      }));

      setProgress(uploads);

      const results: UploadProgress[] = [];

      // Upload in parallel (max 3 at a time)
      const batchSize = 3;
      for (let i = 0; i < uris.length; i += batchSize) {
        const batch = uris.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (uri, batchIndex) => {
            const index = i + batchIndex;
            const uploadId = uploads[index].id;

            try {
              setProgress((prev) =>
                prev.map((p) =>
                  p.id === uploadId ? { ...p, status: 'uploading', progress: 10 } : p
                )
              );

              const url = await uploadPhoto(uri);

              const result: UploadProgress = {
                id: uploadId,
                progress: 100,
                status: url ? 'complete' : 'error',
                url: url || undefined,
                error: url ? undefined : 'Upload failed',
              };

              setProgress((prev) =>
                prev.map((p) => (p.id === uploadId ? result : p))
              );

              return result;
            } catch (error) {
              const result: UploadProgress = {
                id: uploadId,
                progress: 0,
                status: 'error',
                error: error instanceof Error ? error.message : 'Upload failed',
              };

              setProgress((prev) =>
                prev.map((p) => (p.id === uploadId ? result : p))
              );

              return result;
            }
          })
        );

        results.push(...batchResults);
      }

      setIsUploading(false);
      return results;
    },
    [user?.id, uploadPhoto]
  );

  /**
   * Delete a photo from storage
   */
  const deletePhoto = useCallback(
    async (photoUrl: string): Promise<boolean> => {
      if (!user?.id) {
        console.error('User not authenticated');
        return false;
      }

      try {
        // Extract file path from URL
        const url = new URL(photoUrl);
        const pathParts = url.pathname.split('/');
        const bucketIndex = pathParts.indexOf(BUCKET_NAME);

        if (bucketIndex === -1) {
          console.error('Invalid photo URL');
          return false;
        }

        const filePath = pathParts.slice(bucketIndex + 1).join('/');

        const { error } = await supabase.storage
          .from(BUCKET_NAME)
          .remove([filePath]);

        if (error) {
          throw error;
        }

        return true;
      } catch (error) {
        console.error('Error deleting photo:', error);
        return false;
      }
    },
    [user?.id]
  );

  return {
    pickAndUploadPhoto,
    uploadPhoto,
    uploadMultiplePhotos,
    isUploading,
    progress,
    deletePhoto,
  };
}
