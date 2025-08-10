// api/generate-work-report.ts - Puppeteer-baserad saneringsrapport generator
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { generateWorkReportBase64, type TaskDetails, type CustomerInfo } from '../src/lib/pdf-generator'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { taskDetails, customerInfo } = req.body as {
      taskDetails: TaskDetails
      customerInfo: CustomerInfo
    }

    if (!taskDetails || !customerInfo) {
      return res.status(400).json({ error: 'Missing taskDetails or customerInfo' })
    }

    console.log('Generating work report PDF for task:', taskDetails.task_id)

    // Generate PDF using shared module
    const result = await generateWorkReportBase64(taskDetails, customerInfo)
    
    res.status(200).json({ 
      success: true, 
      pdf: result.pdf,
      filename: result.filename
    })

  } catch (error) {
    console.error('PDF generation error:', error)
    res.status(500).json({ 
      error: 'Failed to generate PDF',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}