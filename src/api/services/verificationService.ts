/**
 * Identity Verification Service
 *
 * Integrates with identity verification providers (Onfido or Jumio) to verify user identity
 * via ID document and selfie comparison.
 *
 * OFF, BEHIND `FEATURE_PHOTO_VERIFICATION` (MEXA-359). Nothing in here runs today.
 * `verifyIdentity()` refuses before it touches a photo. Two things were wrong at once:
 *
 *   1. No provider is configured in any build, and the old code read that as "use mock
 *      mode" - `verifyMock()` returns `verified: Math.random() > 0.1` - and then wrote
 *      `users.is_verified = true` on the strength of it. So the app's own "Verify Your
 *      Profile" button handed out the trust badge other users see, on a coin flip, after
 *      the user photographed anything at all.
 *   2. The AWS path read its credentials from `EXPO_PUBLIC_AWS_*`, which Metro inlines into
 *      the bundle, so configuring it would have shipped an AWS secret key inside the IPA.
 *
 * `is_verified` is now `service_role`-only
 * (`supabase/migrations/00024_revoke_self_awarded_verified_badge.sql`), so no client can
 * write it at all. Verification comes back as a Supabase Edge Function that calls
 * Rekognition server-side (MEXA-359 Part B); that function, not this file, will set the
 * flag.
 *
 * LEGAL COMPLIANCE (unchanged, and Part B must keep it):
 * - User consent is required before collecting data
 * - ID photos are deleted immediately after verification
 * - Only verification status is stored, not ID data
 * - GDPR/CCPA compliant data handling
 *
 * PROVIDER OPTIONS:
 * - Onfido: Full-featured identity verification, $2-5 per verification
 * - Jumio: Enterprise-grade, $3-6 per verification
 */

import { env, isVerificationConfigured } from '@/lib/config/env';
import { FEATURE_PHOTO_VERIFICATION } from '@/lib/config/features';
import { supabase } from '@/api/supabase/client';

// Verification result types
export interface VerificationResult {
  success: boolean;
  verified: boolean;
  confidence?: number;
  reason?: string;
  error?: string;
}

export interface VerificationRequest {
  userId: string;
  idPhotoUri: string;
  selfiePhotoUri: string;
}

// Base64 encode a local file URI for upload
async function uriToBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Remove the data:image/xxx;base64, prefix
      const base64Data = base64.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// There used to be an uploadToTempStorage() here. It was dead code - nothing ever called
// it - and it uploaded the ID document and the selfie to a `verification-temp` bucket and
// then handed back getPublicUrl(), i.e. a permanent unauthenticated URL to someone's
// passport photo. Removed on MEXA-249 rather than left lying around, because the obvious
// way to "fix" verification later is to call the function that is already written.
//
// verifyIdentity() below sends both images straight to the provider and keeps nothing.
// If images ever do need to be staged in Supabase, the bucket must be PRIVATE and reads
// must go through short-lived signed URLs. The hourly `cleanup-verification-photos` cron
// (MEXA-249) is already scheduled to delete anything that lands under verification/.

// Delete temporary verification images
async function cleanupTempImages(userId: string): Promise<void> {
  try {
    const { data: files } = await supabase.storage
      .from('verification-temp')
      .list(`verification/${userId}`);

    if (files && files.length > 0) {
      const filePaths = files.map((f) => `verification/${userId}/${f.name}`);
      await supabase.storage.from('verification-temp').remove(filePaths);
    }
  } catch (error) {
    console.error('Failed to cleanup temp verification images:', error);
  }
}

// Onfido verification implementation
async function verifyWithOnfido(
  idPhotoBase64: string,
  selfiePhotoBase64: string
): Promise<VerificationResult> {
  const apiToken = env.ONFIDO_API_TOKEN;

  if (!apiToken) {
    return { success: false, verified: false, error: 'Onfido not configured' };
  }

  try {
    // Step 1: Create an applicant
    const applicantResponse = await fetch('https://api.onfido.com/v3.6/applicants', {
      method: 'POST',
      headers: {
        'Authorization': `Token token=${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        first_name: 'User',
        last_name: 'Verification',
      }),
    });

    if (!applicantResponse.ok) {
      throw new Error('Failed to create Onfido applicant');
    }

    const applicant = await applicantResponse.json();
    const applicantId = applicant.id;

    // Step 2: Upload document
    const documentFormData = new FormData();
    documentFormData.append('applicant_id', applicantId);
    documentFormData.append('type', 'passport'); // or 'driving_licence', 'national_identity_card'
    documentFormData.append('file', {
      uri: `data:image/jpeg;base64,${idPhotoBase64}`,
      type: 'image/jpeg',
      name: 'document.jpg',
    } as any);

    const documentResponse = await fetch('https://api.onfido.com/v3.6/documents', {
      method: 'POST',
      headers: {
        'Authorization': `Token token=${apiToken}`,
      },
      body: documentFormData,
    });

    if (!documentResponse.ok) {
      throw new Error('Failed to upload document to Onfido');
    }

    // Step 3: Upload live photo (selfie)
    const photoFormData = new FormData();
    photoFormData.append('applicant_id', applicantId);
    photoFormData.append('file', {
      uri: `data:image/jpeg;base64,${selfiePhotoBase64}`,
      type: 'image/jpeg',
      name: 'selfie.jpg',
    } as any);

    const photoResponse = await fetch('https://api.onfido.com/v3.6/live_photos', {
      method: 'POST',
      headers: {
        'Authorization': `Token token=${apiToken}`,
      },
      body: photoFormData,
    });

    if (!photoResponse.ok) {
      throw new Error('Failed to upload selfie to Onfido');
    }

    // Step 4: Create a check
    const checkResponse = await fetch('https://api.onfido.com/v3.6/checks', {
      method: 'POST',
      headers: {
        'Authorization': `Token token=${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        applicant_id: applicantId,
        report_names: ['document', 'facial_similarity_photo'],
      }),
    });

    if (!checkResponse.ok) {
      throw new Error('Failed to create Onfido check');
    }

    const check = await checkResponse.json();

    // Step 5: Poll for results (simplified - in production use webhooks)
    let attempts = 0;
    const maxAttempts = 30;
    let result = check;

    while (result.status === 'in_progress' && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const statusResponse = await fetch(
        `https://api.onfido.com/v3.6/checks/${check.id}`,
        {
          headers: {
            'Authorization': `Token token=${apiToken}`,
          },
        }
      );
      result = await statusResponse.json();
      attempts++;
    }

    // Analyze results
    const isVerified = result.result === 'clear';
    const reports = result.report_ids || [];

    return {
      success: true,
      verified: isVerified,
      confidence: isVerified ? 0.95 : 0.3,
      reason: isVerified ? 'Identity verified successfully' : 'Verification failed - documents do not match',
    };
  } catch (error) {
    console.error('Onfido verification error:', error);
    return {
      success: false,
      verified: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Jumio verification implementation
async function verifyWithJumio(
  idPhotoBase64: string,
  selfiePhotoBase64: string
): Promise<VerificationResult> {
  const apiToken = env.JUMIO_API_TOKEN;
  const apiSecret = env.JUMIO_API_SECRET;

  if (!apiToken || !apiSecret) {
    return { success: false, verified: false, error: 'Jumio not configured' };
  }

  try {
    const authHeader = Buffer.from(`${apiToken}:${apiSecret}`).toString('base64');

    // Create a verification transaction
    const response = await fetch('https://netverify.com/api/netverify/v2/performNetverify', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Mazal/1.0',
      },
      body: JSON.stringify({
        merchantIdScanReference: `mazal-${Date.now()}`,
        frontsideImage: idPhotoBase64,
        faceImage: selfiePhotoBase64,
        enabledFields: 'idNumber,idFirstName,idLastName',
        country: 'USA',
        idType: 'PASSPORT',
      }),
    });

    if (!response.ok) {
      throw new Error('Jumio verification request failed');
    }

    const result = await response.json();

    const isVerified = result.identityVerification?.validity === true &&
                       result.identityVerification?.similarity === 'MATCH';

    return {
      success: true,
      verified: isVerified,
      confidence: result.identityVerification?.similarity === 'MATCH' ? 0.9 : 0.2,
      reason: isVerified ? 'Identity verified' : 'Face does not match ID document',
    };
  } catch (error) {
    console.error('Jumio verification error:', error);
    return {
      success: false,
      verified: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// AWS Rekognition verification lived here and is gone (MEXA-359).
//
// It read `env.AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`, which `src/lib/config/env.ts`
// mapped from `EXPO_PUBLIC_AWS_*` - variables Metro inlines into the JS bundle. Shipping it
// with credentials set would have put a long-lived AWS secret key inside the IPA. It never
// ran in any build, because no `EXPO_PUBLIC_AWS_*` value is set in `.env`, in any `eas.json`
// profile, or in EAS environment variables.
//
// Rekognition comes back as a Supabase Edge Function (MEXA-359 Part B): the compare runs
// server-side on an IAM user scoped to `rekognition:CompareFaces`, the key lives in a
// function secret, and the function writes `users.is_verified` as `service_role` - which is
// now the only role that can, per
// `supabase/migrations/00024_revoke_self_awarded_verified_badge.sql`.

// `verifyMock()` lived here and is gone (MEXA-359).
//
// It returned `verified: Math.random() > 0.1, confidence: 0.95, reason: 'Identity verified
// (mock mode)'` after a 2s sleep, and `verifyIdentity()` called it whenever no provider was
// configured - which is every build ever made - and then wrote `users.is_verified` from the
// result. A stub that reports a 0.95 confidence it did not measure is not a test double, it
// is a forgery; it is the whole reason the badge was reachable from a button rather than only
// from a crafted request. Part B verifies against the real Edge Function, so nothing needs a
// stand-in that can say yes.

/**
 * Main verification function
 *
 * Verifies user identity by comparing ID document with selfie photo.
 * Uses configured provider (Onfido or Jumio).
 *
 * @param request - User ID, ID photo URI, and selfie photo URI
 * @returns Verification result with success status and confidence
 */
export async function verifyIdentity(
  request: VerificationRequest
): Promise<VerificationResult> {
  const { userId, idPhotoUri, selfiePhotoUri } = request;

  // MEXA-359: closed until verification is server-side. This is checked before the ID photo
  // is read, so a caller that reaches here despite the gated route and hidden button still
  // hands no ID document to anything. `FEATURE_PHOTO_VERIFICATION` is inlined by Metro, so
  // the rest of this function is statically unreachable in a shipped bundle.
  if (!FEATURE_PHOTO_VERIFICATION) {
    console.log('[Verification] Disabled: photo verification has not moved server-side yet');
    return {
      success: false,
      verified: false,
      error: 'Profile verification is temporarily unavailable.',
    };
  }

  console.log('[Verification] Starting verification for user:', userId);

  try {
    // MEXA-359: an unconfigured provider is a hard failure now. It used to mean "use mock
    // mode", and mock mode returned `verified: true` 90% of the time and then wrote the
    // badge - which is how a self-awarded "verified" badge became reachable by tapping a
    // button. `verifyMock()` is gone with it - see below.
    if (!isVerificationConfigured()) {
      console.warn('[Verification] No provider configured; refusing to guess');
      return {
        success: false,
        verified: false,
        error: 'Verification is not configured. Please try again later.',
      };
    }

    // Convert images to base64
    console.log('[Verification] Converting images to base64...');
    const idPhotoBase64 = await uriToBase64(idPhotoUri);
    const selfiePhotoBase64 = await uriToBase64(selfiePhotoUri);

    // Call appropriate provider
    let result: VerificationResult;
    const provider = env.VERIFICATION_PROVIDER;

    console.log('[Verification] Using provider:', provider);

    switch (provider) {
      case 'onfido':
        result = await verifyWithOnfido(idPhotoBase64, selfiePhotoBase64);
        break;
      case 'jumio':
        result = await verifyWithJumio(idPhotoBase64, selfiePhotoBase64);
        break;
      default:
        result = { success: false, verified: false, error: 'Unknown verification provider.' };
    }

    // MEXA-359: the `users.is_verified` write that used to be here is gone. The client is no
    // longer allowed to make it - 00024 revokes `UPDATE (is_verified)` from `authenticated`,
    // so it would return 42501 - and it should never have been the client's call. The Edge
    // Function in Part B runs the compare and writes the flag as `service_role`.

    // Cleanup - delete temporary images (privacy compliance)
    await cleanupTempImages(userId);

    console.log('[Verification] Result:', result);
    return result;
  } catch (error) {
    console.error('[Verification] Error:', error);
    return {
      success: false,
      verified: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

// `updateUserVerificationStatus()` lived here and is gone (MEXA-359).
//
// It did `supabase.from('users').update({ is_verified })` from the device. That write is the
// defect this issue is about: it ran on the word of on-device code - usually `verifyMock()`,
// a coin flip - and `authenticated` held `UPDATE (is_verified)` so the database allowed it.
// It also swallowed its own error, so a refusal would have looked like a success to the
// caller.
//
// There is no client-side replacement, by design. 00024 revokes the grant, and the Edge
// Function in Part B writes the flag as `service_role` after a server-side compare. Note for
// whoever builds it: the badge is what other users are shown, so the write belongs on the
// same side of the wire as the decision.

/**
 * Check if user is already verified
 */
export async function isUserVerified(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('is_verified')
      .eq('auth_id', userId)
      .single();

    if (error) {
      console.error('[Verification] Failed to check status:', error);
      return false;
    }

    return data?.is_verified === true;
  } catch (error) {
    console.error('[Verification] Error checking status:', error);
    return false;
  }
}
