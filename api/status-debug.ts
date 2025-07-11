// api/status-debug.ts - Hämta status-ID:n från ClickUp (fungerande version)
import type { VercelRequest, VercelResponse } from '@vercel/node'

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN!

// Era BeGone List IDs
const LISTS = {
  privatperson: '901204857438',
  foretag: '901204857574'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Samma CORS-setup som era fungerande API:er
  res.setHeader('Access-Control-Allow-Origin', '*')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (!CLICKUP_API_TOKEN) {
    return res.status(500).json({ 
      error: 'CLICKUP_API_TOKEN saknas i environment variables'
    })
  }

  // HTML-interface för enkel åtkomst (samma som test-clickup.ts)
  if (!req.query.action) {
    const html = `<!DOCTYPE html>
<html lang="sv">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ClickUp Status Debug</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 900px; margin: 20px auto; padding: 20px; background-color: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; text-align: center; margin-bottom: 30px; }
        .test-section { background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #007cba; }
        .test-section h3 { margin-top: 0; color: #007cba; }
        button { padding: 10px 20px; background: #007cba; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; margin: 5px; }
        button:hover { background: #005a8b; }
        #result { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 15px; margin: 20px 0; white-space: pre-wrap; font-family: 'Courier New', monospace; font-size: 12px; max-height: 600px; overflow-y: auto; }
        .error { background: #f8d7da; border-color: #f5c6cb; color: #721c24; }
        .loading { color: #0c5460; font-style: italic; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 ClickUp Status Debug</h1>
        
        <div class="test-section">
            <h3>📋 Hämta Status-ID:n från BeGone Listor</h3>
            <p>Analyserar era ClickUp-statusar och genererar mappning-kod:</p>
            <button onclick="debugStatuses()">🚀 Analysera Alla Statusar</button>
            <button onclick="debugList('privatperson')">👤 Bara Privatperson</button>
            <button onclick="debugList('foretag')">🏢 Bara Företag</button>
        </div>

        <div id="result">Klicka på en knapp för att börja analys...</div>
    </div>

    <script>
        function debugStatuses() {
            const resultDiv = document.getElementById('result');
            resultDiv.className = 'loading';
            resultDiv.textContent = '⏳ Analyserar alla ClickUp-statusar...';
            
            fetch('/api/status-debug?action=all')
                .then(response => response.json())
                .then(data => {
                    resultDiv.className = '';
                    if (data.error) {
                        resultDiv.className = 'error';
                        resultDiv.textContent = '❌ FEL: ' + data.error;
                    } else {
                        resultDiv.textContent = JSON.stringify(data, null, 2);
                    }
                })
                .catch(error => {
                    resultDiv.className = 'error';
                    resultDiv.textContent = '❌ NÄTVERKSFEL: ' + error.message;
                });
        }

        function debugList(listType) {
            const resultDiv = document.getElementById('result');
            resultDiv.className = 'loading';
            resultDiv.textContent = '⏳ Analyserar ' + listType + '-lista...';
            
            fetch('/api/status-debug?action=list&list_type=' + listType)
                .then(response => response.json())
                .then(data => {
                    resultDiv.className = '';
                    if (data.error) {
                        resultDiv.className = 'error';
                        resultDiv.textContent = '❌ FEL: ' + data.error;
                    } else {
                        resultDiv.textContent = JSON.stringify(data, null, 2);
                    }
                })
                .catch(error => {
                    resultDiv.className = 'error';
                    resultDiv.textContent = '❌ NÄTVERKSFEL: ' + error.message;
                });
        }

        window.onload = function() {
            document.getElementById('result').textContent = '✅ Status Debug laddad! Välj en analys-metod ovan.';
        };
    </script>
</body>
</html>`
    
    return res.status(200).send(html)
  }

  // Status-analys baserat på action parameter
  try {
    const action = req.query.action as string
    const listType = req.query.list_type as string

    if (action === 'all') {
      // Analysera båda listorna
      const results: any = {
        success: true,
        timestamp: new Date().toISOString(),
        lists_analyzed: []
      }

      for (const [type, listId] of Object.entries(LISTS)) {
        try {
          const listData = await analyzeList(listId, type)
          results.lists_analyzed.push(listData)
        } catch (error) {
          results.lists_analyzed.push({
            list_type: type,
            list_id: listId,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      // Generera implementation-kod
      results.implementation = generateImplementationCode(results.lists_analyzed)
      
      return res.status(200).json(results)

    } else if (action === 'list' && listType && LISTS[listType as keyof typeof LISTS]) {
      // Analysera en specifik lista
      const listId = LISTS[listType as keyof typeof LISTS]
      const listData = await analyzeList(listId, listType)
      
      return res.status(200).json({
        success: true,
        timestamp: new Date().toISOString(),
        ...listData
      })

    } else {
      return res.status(400).json({
        error: 'Ogiltig action eller list_type',
        usage: 'Använd ?action=all eller ?action=list&list_type=privatperson/foretag'
      })
    }

  } catch (error: any) {
    return res.status(500).json({
      error: 'Status-analys misslyckades',
      details: error.message
    })
  }
}

async function analyzeList(listId: string, listType: string): Promise<any> {
  console.log(`Analyserar ${listType} lista (${listId})...`)

  // 1. Hämta list-konfiguration
  const listResponse = await fetch(`https://api.clickup.com/api/v2/list/${listId}`, {
    headers: {
      'Authorization': CLICKUP_API_TOKEN,
      'Content-Type': 'application/json'
    }
  })

  if (!listResponse.ok) {
    throw new Error(`List API error: ${listResponse.status} ${listResponse.statusText}`)
  }

  const listData = await listResponse.json()
  const configuredStatuses = listData.statuses || []

  // 2. Hämta några tasks för att se verklig status-struktur
  const tasksResponse = await fetch(
    `https://api.clickup.com/api/v2/list/${listId}/task?limit=5&include_closed=true`,
    {
      headers: {
        'Authorization': CLICKUP_API_TOKEN,
        'Content-Type': 'application/json'
      }
    }
  )

  const tasks = tasksResponse.ok ? (await tasksResponse.json()).tasks || [] : []

  // 3. Samla status-information
  const statusMapping: any = {}

  // Från list-konfiguration (officiella definitioner)
  configuredStatuses.forEach((status: any) => {
    statusMapping[status.status] = {
      id: status.id,
      status: status.status,
      color: status.color,
      type: status.type,
      orderindex: status.orderindex,
      source: 'list_config'
    }
  })

  // Från faktiska tasks (för verifiering)
  const taskStatusExamples: any[] = []
  tasks.forEach((task: any) => {
    if (task.status) {
      taskStatusExamples.push({
        task_id: task.id,
        task_name: task.name,
        status: {
          id: task.status.id,
          status: task.status.status,
          color: task.status.color,
          type: task.status.type
        }
      })

      // Verifiera att task-status matchar list-config
      const statusName = task.status.status
      if (statusMapping[statusName]) {
        statusMapping[statusName].verified_in_tasks = true
        statusMapping[statusName].task_status_id = task.status.id
      }
    }
  })

  return {
    list_type: listType,
    list_id: listId,
    list_name: listData.name,
    total_configured_statuses: configuredStatuses.length,
    status_mapping: statusMapping,
    task_examples: taskStatusExamples,
    verification: {
      all_statuses_verified: Object.values(statusMapping).every((s: any) => s.verified_in_tasks),
      consistency_issues: Object.values(statusMapping).filter((s: any) => 
        s.task_status_id && s.id !== s.task_status_id
      )
    }
  }
}

function generateImplementationCode(listsData: any[]): any {
  const allStatuses: any = {}
  
  listsData.forEach(listData => {
    if (listData.status_mapping) {
      Object.assign(allStatuses, listData.status_mapping)
    }
  })

  const statusIds = Object.keys(allStatuses)
  const typeDefinition = statusIds.map(status => `  | '${status}'`).join('\n')
  
  const idMapping = Object.entries(allStatuses)
    .map(([status, info]: [string, any]) => 
      `  '${info.id}': '${status}', // ${status} (${info.color})`
    ).join('\n')

  const nameToIdMapping = Object.entries(allStatuses)
    .map(([status, info]: [string, any]) => 
      `  '${status}': '${info.id}',`
    ).join('\n')

  const statusConfig = Object.entries(allStatuses)
    .map(([status, info]: [string, any]) => 
      `  '${status}': {\n    id: '${info.id}',\n    color: '${info.color}',\n    type: '${info.type}'\n  }`
    ).join(',\n')

  return {
    typescript_types: `// TypeScript type för era ClickUp-statusar
export type ClickUpStatus = 
${typeDefinition}`,

    id_mappings: `// Status-ID till status-namn mappning
export const STATUS_ID_TO_NAME: { [key: string]: string } = {
${idMapping}
}

// Status-namn till ID mappning  
export const STATUS_NAME_TO_ID: { [key: string]: string } = {
${nameToIdMapping}
}`,

    status_config: `// Komplett status-konfiguration
export const STATUS_CONFIG: { [key: string]: any } = {
${statusConfig}
}`,

    usage_example: `// Användning i API:er:
// Spara både namn och ID
const caseData = {
  status: task.status?.status,           // "bokat"
  status_id: task.status?.id,           // "c127553498_E9tR4uKl"  
}

// Lookup baserat på ID
function getStatusName(statusId: string): string {
  return STATUS_ID_TO_NAME[statusId] || 'Okänd status'
}`
  }
}