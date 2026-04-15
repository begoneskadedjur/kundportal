// api/cron/cleanup-ai-images.ts
// Raderar utgångna AI-genererade bilder från Supabase Storage
// Körs automatiskt varje natt kl 05:00 via Vercel Cron

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Hämta alla meddelanden med utgångna bilder
    const { data: expiredMessages, error: fetchError } = await supabase
      .from('ai_team_messages')
      .select('id, generated_image_url')
      .lt('generated_image_expires_at', new Date().toISOString())
      .not('generated_image_url', 'is', null);

    if (fetchError) throw fetchError;

    if (!expiredMessages || expiredMessages.length === 0) {
      return res.status(200).json({ success: true, deleted: 0 });
    }

    // Radera filer från Storage
    const filenames = expiredMessages
      .map(msg => {
        const url = msg.generated_image_url as string;
        return url.split('/').pop() || '';
      })
      .filter(Boolean);

    if (filenames.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('ai-generated-images')
        .remove(filenames);
      if (storageError) {
        console.error('Storage removal error:', storageError);
      }
    }

    // Nolla URL-kolumnen — meddelandet finns kvar, bara bilden är borta
    const ids = expiredMessages.map(msg => msg.id);
    const { error: updateError } = await supabase
      .from('ai_team_messages')
      .update({ generated_image_url: null, generated_image_expires_at: null })
      .in('id', ids);

    if (updateError) throw updateError;

    console.log(`[cleanup-ai-images] Raderade ${filenames.length} bilder`);
    return res.status(200).json({ success: true, deleted: filenames.length });
  } catch (error) {
    console.error('[cleanup-ai-images] Error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Okänt fel' });
  }
}
