// api/test-clickup.ts - TEST ENDPOINT FÖR DEBUGGING
import type { VercelRequest, VercelResponse } from '@vercel/node'

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN!

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Returnera HTML-sida för enkel testning
  if (req.method === 'GET' && !req.query.list_id) {
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>ClickUp API Test</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          .test-form { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .result { background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0; white-space: pre-wrap; }
          .error { background: #ffe8e8; color: #d00; }
          input, button { padding: 10px; margin: 5px; }
          button { background: #007cba; color: white; border: none; border-radius: 4px; cursor: pointer; }
        </style>
      </head>
      <body>
        <h1>ClickUp API Test</h1>
        
        <div class="test-form">
          <h3>Test med List ID från din databas:</h3>
          <p>Ange List ID från customers tabellen (clickup_list_id):</p>
          <input type="text" id="listId" placeholder="Ange List ID" style="width: 300px;">
          <button onclick="testClickUp()">Testa ClickUp API</button>
        </div>

        <div id="result"></div>

        <script>
          async function testClickUp() {
            const listId = document.getElementById('listId').value;
            if (!listId) {
              alert('Ange ett List ID');
              return;
            }

            const resultDiv = document.getElementById('result');
            resultDiv.innerHTML = 'Testing...';

            try {
              const response = await fetch('/api/test-clickup?list_id=' + listId);
              const data = await response.json();
              
              resultDiv.className = response.ok ? 'result' : 'result error';
              resultDiv.innerHTML = JSON.stringify(data, null, 2);
            } catch (error) {
              resultDiv.className = 'result error';
              resultDiv.innerHTML = 'Error: ' + error.message;
            }
          }
        </script>
      </body>
      </html>
    `)
  }

  // API-test med list_id
  const { list_id } = req.query

  if (!list_id || typeof list_id !== 'string') {
    return res.status(400).json({ error: 'list_id parameter is required' })
  }

  try {
    console.log('Testing ClickUp API with list_id:', list_id)

    // Test 1: Kolla API-token
    if (!CLICKUP_API_TOKEN) {
      return res.status(500).json({
        error: 'CLICKUP_API_TOKEN not configured',
        tests: {
          token_exists: false
        }
      })
    }

    // Test 2: Hämta list-information
    const listResponse = await fetch(
      `https://api.clickup.com/api/v2/list/${list_id}`,
      {
        method: 'GET',
        headers: {
          'Authorization': CLICKUP_API_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    )

    const listData = listResponse.ok ? await listResponse.json() : null
    
    // Test 3: Hämta tasks
    const tasksResponse = await fetch(
      `https://api.clickup.com/api/v2/list/${list_id}/task?include_closed=true`,
      {
        method: 'GET',
        headers: {
          'Authorization': CLICKUP_API_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    )

    const tasksData = tasksResponse.ok ? await tasksResponse.json() : null

    // Test 4: Om inga tasks, försök med folder
    let folderTasksData = null
    if (listData && listData.folder && (!tasksData || !tasksData.tasks || tasksData.tasks.length === 0)) {
      const folderResponse = await fetch(
        `https://api.clickup.com/api/v2/folder/${listData.folder.id}/task`,
        {
          method: 'GET',
          headers: {
            'Authorization': CLICKUP_API_TOKEN,
            'Content-Type': 'application/json',
          },
        }
      )
      folderTasksData = folderResponse.ok ? await folderResponse.json() : null
    }

    return res.status(200).json({
      success: true,
      list_id: list_id,
      tests: {
        token_exists: !!CLICKUP_API_TOKEN,
        token_length: CLICKUP_API_TOKEN.length,
        list_response: {
          status: listResponse.status,
          ok: listResponse.ok,
          data: listData ? {
            id: listData.id,
            name: listData.name,
            task_count: listData.task_count,
            folder: listData.folder ? {
              id: listData.folder.id,
              name: listData.folder.name
            } : null
          } : null
        },
        tasks_response: {
          status: tasksResponse.status,
          ok: tasksResponse.ok,
          tasks_count: tasksData?.tasks?.length || 0,
          tasks: tasksData?.tasks?.map((t: any) => ({
            id: t.id,
            name: t.name,
            status: t.status?.status
          })) || []
        },
        folder_tasks_response: folderTasksData ? {
          tasks_count: folderTasksData.tasks?.length || 0,
          tasks: folderTasksData.tasks?.map((t: any) => ({
            id: t.id,
            name: t.name,
            status: t.status?.status
          })) || []
        } : null
      }
    })

  } catch (error: any) {
    return res.status(500).json({
      error: error.message,
      stack: error.stack
    })
  }
}