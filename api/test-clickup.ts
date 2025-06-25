// api/test-clickup.ts - ENHANCED VERSION WITH DROPDOWN CONFIG
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN

  res.setHeader('Access-Control-Allow-Origin', '*')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (!CLICKUP_API_TOKEN) {
    return res.status(500).json({ 
      error: 'CLICKUP_API_TOKEN saknas i environment variables'
    })
  }

  // HTML test interface (unchanged)
  if (!req.query.list_id && !req.query.task_id) {
    const html = `<!DOCTYPE html>
<html lang="sv">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ClickUp API Test</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 900px; margin: 20px auto; padding: 20px; background-color: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; text-align: center; margin-bottom: 30px; }
        .test-section { background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #007cba; }
        .test-section h3 { margin-top: 0; color: #007cba; }
        input[type="text"] { padding: 10px; width: 250px; border: 1px solid #ddd; border-radius: 4px; margin-right: 10px; }
        button { padding: 10px 20px; background: #007cba; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }
        button:hover { background: #005a8b; }
        #result { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 15px; margin: 20px 0; white-space: pre-wrap; font-family: 'Courier New', monospace; font-size: 12px; max-height: 500px; overflow-y: auto; }
        .error { background: #f8d7da; border-color: #f5c6cb; color: #721c24; }
        .loading { color: #0c5460; font-style: italic; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 ClickUp API Test - Enhanced</h1>
        
        <div class="test-section">
            <h3>📋 Test 1: Hämta Tasks från List</h3>
            <p>Testar att hämta alla tasks från en specifik ClickUp-lista:</p>
            <input type="text" id="listInput" value="901210684656" placeholder="Ange List ID">
            <button onclick="testList()">🚀 Testa List</button>
        </div>

        <div class="test-section">
            <h3>📝 Test 2: Analysera Specifik Task (med dropdown config)</h3>
            <p>Får detaljerad information om en task inklusive dropdown-alternativ:</p>
            <input type="text" id="taskInput" placeholder="Ange Task ID">
            <button onclick="testTask()">🔍 Analysera Task</button>
        </div>

        <div id="result">Klicka på en test-knapp för att börja...</div>
    </div>

    <script>
        function testList() {
            const listId = document.getElementById('listInput').value.trim();
            if (!listId) {
                alert('❌ Vänligen ange ett List ID');
                return;
            }
            
            const resultDiv = document.getElementById('result');
            resultDiv.className = 'loading';
            resultDiv.textContent = '⏳ Hämtar data från ClickUp...';
            
            fetch('/api/test-clickup?list_id=' + encodeURIComponent(listId))
                .then(response => response.json())
                .then(data => {
                    resultDiv.className = '';
                    if (data.error) {
                        resultDiv.className = 'error';
                        resultDiv.textContent = '❌ FEL: ' + data.error;
                    } else {
                        resultDiv.textContent = JSON.stringify(data, null, 2);
                        
                        if (data.tasks && data.tasks.length > 0) {
                            let buttonHTML = '\\n\\n=== TASKS (klicka för att analysera) ===\\n';
                            data.tasks.forEach((task, index) => {
                                buttonHTML += '\\n' + (index + 1) + '. ' + task.name + ' (ID: ' + task.id + ')';
                            });
                            resultDiv.textContent += buttonHTML;
                            
                            document.getElementById('taskInput').value = data.tasks[0].id;
                        }
                    }
                })
                .catch(error => {
                    resultDiv.className = 'error';
                    resultDiv.textContent = '❌ NÄTVERKSFEL: ' + error.message;
                });
        }

        function testTask() {
            const taskId = document.getElementById('taskInput').value.trim();
            if (!taskId) {
                alert('❌ Vänligen ange ett Task ID');
                return;
            }
            
            const resultDiv = document.getElementById('result');
            resultDiv.className = 'loading';
            resultDiv.textContent = '⏳ Analyserar task med dropdown config...';
            
            fetch('/api/test-clickup?task_id=' + encodeURIComponent(taskId))
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
            document.getElementById('result').textContent = '✅ Sidan laddad! Enhanced version med dropdown config.';
        };
    </script>
</body>
</html>`
    
    return res.status(200).send(html)
  }

  // ENHANCED TASK DETAILS with dropdown config
  if (req.query.task_id) {
    const taskId = req.query.task_id as string
    
    try {
      const response = await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, {
        headers: {
          'Authorization': CLICKUP_API_TOKEN,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        return res.status(response.status).json({
          error: `ClickUp API returnerade ${response.status}: ${response.statusText}`,
          details: errorText,
          task_id: taskId
        })
      }

      const taskData = await response.json()

      // Enhanced custom fields with full type_config
      const enhancedCustomFields = taskData.custom_fields?.map((field: any) => ({
        id: field.id,
        name: field.name,
        type: field.type,
        value: field.value,
        has_value: field.value !== null && field.value !== undefined && field.value !== '',
        type_config: field.type_config || null, // Include full dropdown config
        raw_field: field // Include raw field for debugging
      })) || []

      const result = {
        success: true,
        task_id: taskId,
        task_info: {
          name: taskData.name,
          status: taskData.status?.status || 'Ingen status',
          description: taskData.description || '',
          url: taskData.url,
          created: taskData.date_created,
          updated: taskData.date_updated
        },
        assignees: taskData.assignees?.map((a: any) => ({
          name: a.username,
          email: a.email
        })) || [],
        custom_fields: enhancedCustomFields,
        // Add dropdown analysis for debugging
        dropdown_analysis: {
          found_dropdowns: enhancedCustomFields.filter((f: any) => f.type === 'drop_down'),
          dropdown_configs: enhancedCustomFields
            .filter((f: any) => f.type === 'drop_down' && f.type_config?.options)
            .map((f: any) => ({
              field_name: f.name,
              field_value: f.value,
              options: f.type_config.options
            }))
        }
      }

      return res.status(200).json(result)

    } catch (error: any) {
      return res.status(500).json({
        error: 'Kunde inte hämta task från ClickUp',
        details: error.message,
        task_id: taskId
      })
    }
  }

  // LIST TEST (unchanged)
  if (req.query.list_id) {
    const listId = req.query.list_id as string
    
    try {
      const response = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
        headers: {
          'Authorization': CLICKUP_API_TOKEN,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        return res.status(response.status).json({
          error: `ClickUp API returnerade ${response.status}: ${response.statusText}`,
          details: errorText,
          list_id: listId
        })
      }

      const data = await response.json()

      const result = {
        success: true,
        list_id: listId,
        tasks_found: data.tasks?.length || 0,
        tasks: data.tasks?.map((task: any) => ({
          id: task.id,
          name: task.name,
          status: task.status?.status || 'Ingen status',
          description: task.description ? 'Har beskrivning' : 'Ingen beskrivning',
          custom_fields_count: task.custom_fields?.length || 0
        })) || []
      }

      return res.status(200).json(result)

    } catch (error: any) {
      return res.status(500).json({
        error: 'Kunde inte hämta tasks från ClickUp',
        details: error.message,
        list_id: listId
      })
    }
  }

  return res.status(400).json({ 
    error: 'Ogiltiga parametrar',
    usage: 'Använd ?list_id=XXX för att testa lista eller ?task_id=XXX för att testa task'
  })
}