// api/test-clickup.ts - ULTRA SIMPLE VERSION
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN

  // Sätt headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json')

  // OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Kontrollera API token
  if (!CLICKUP_API_TOKEN) {
    return res.status(500).json({ 
      error: 'CLICKUP_API_TOKEN saknas',
      configured: false
    })
  }

  // Om ingen parameter - visa enkel HTML
  if (!req.query.list_id && !req.query.task_id) {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>ClickUp Test</title>
  <style>
    body { font-family: Arial; max-width: 800px; margin: 50px auto; padding: 20px; }
    .form { background: #f0f0f0; padding: 20px; margin: 20px 0; border-radius: 5px; }
    input { padding: 8px; width: 200px; margin: 5px; }
    button { padding: 8px 15px; background: #007cba; color: white; border: none; border-radius: 3px; cursor: pointer; }
    .result { background: #f9f9f9; padding: 15px; margin: 20px 0; border: 1px solid #ddd; white-space: pre-wrap; font-family: monospace; }
    .error { background: #ffe6e6; border-color: #ff9999; }
  </style>
</head>
<body>
  <h1>ClickUp API Test</h1>
  
  <div class="form">
    <h3>Test List (hämta alla tasks)</h3>
    <input type="text" id="listId" value="901210684656" placeholder="List ID">
    <button onclick="testList()">Test List</button>
  </div>

  <div class="form">
    <h3>Test Task (detaljerad info)</h3>
    <input type="text" id="taskId" placeholder="Task ID">
    <button onclick="testTask()">Test Task</button>
  </div>

  <div id="result"></div>

  <script>
    function testList() {
      const listId = document.getElementById('listId').value;
      if (!listId) return alert('Ange List ID');
      
      document.getElementById('result').innerHTML = 'Laddar...';
      
      fetch('/api/test-clickup?list_id=' + listId)
        .then(response => response.json())
        .then(data => {
          document.getElementById('result').className = 'result';
          document.getElementById('result').innerHTML = JSON.stringify(data, null, 2);
          
          if (data.tasks && data.tasks.length > 0) {
            let buttons = '\\n\\nTasks (klicka för att testa):';
            data.tasks.forEach(task => {
              buttons += '\\n<button onclick="setTask(\\''+task.id+'\\')">'+task.name+'</button>';
            });
            document.getElementById('result').innerHTML += buttons;
          }
        })
        .catch(err => {
          document.getElementById('result').className = 'result error';
          document.getElementById('result').innerHTML = 'Error: ' + err.message;
        });
    }

    function testTask() {
      const taskId = document.getElementById('taskId').value;
      if (!taskId) return alert('Ange Task ID');
      
      document.getElementById('result').innerHTML = 'Laddar task...';
      
      fetch('/api/test-clickup?task_id=' + taskId)
        .then(response => response.json())
        .then(data => {
          document.getElementById('result').className = 'result';
          document.getElementById('result').innerHTML = JSON.stringify(data, null, 2);
        })
        .catch(err => {
          document.getElementById('result').className = 'result error';
          document.getElementById('result').innerHTML = 'Error: ' + err.message;
        });
    }

    function setTask(taskId) {
      document.getElementById('taskId').value = taskId;
      testTask();
    }
  </script>
</body>
</html>`
    
    return res.status(200).send(html)
  }

  // TEST TASK
  if (req.query.task_id) {
    const taskId = req.query.task_id
    
    try {
      const response = await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, {
        headers: {
          'Authorization': CLICKUP_API_TOKEN,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        return res.status(response.status).json({
          error: `ClickUp API fel: ${response.status}`,
          task_id: taskId
        })
      }

      const taskData = await response.json()

      return res.status(200).json({
        success: true,
        task_id: taskId,
        task_name: taskData.name,
        task_status: taskData.status?.status,
        task_description: taskData.description,
        assignees: taskData.assignees?.length || 0,
        custom_fields_count: taskData.custom_fields?.length || 0,
        custom_fields: taskData.custom_fields?.map((field) => ({
          id: field.id,
          name: field.name,
          type: field.type,
          value: field.value
        })) || [],
        full_data: taskData
      })

    } catch (error) {
      return res.status(500).json({
        error: 'Fel vid hämtning av task',
        details: error.message,
        task_id: taskId
      })
    }
  }

  // TEST LIST
  if (req.query.list_id) {
    const listId = req.query.list_id
    
    try {
      const response = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
        headers: {
          'Authorization': CLICKUP_API_TOKEN,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        return res.status(response.status).json({
          error: `ClickUp API fel: ${response.status}`,
          list_id: listId
        })
      }

      const data = await response.json()

      return res.status(200).json({
        success: true,
        list_id: listId,
        tasks_count: data.tasks?.length || 0,
        tasks: data.tasks?.map((task) => ({
          id: task.id,
          name: task.name,
          status: task.status?.status,
          custom_fields_count: task.custom_fields?.length || 0
        })) || [],
        full_data: data
      })

    } catch (error) {
      return res.status(500).json({
        error: 'Fel vid hämtning av lista',
        details: error.message,
        list_id: listId
      })
    }
  }

  return res.status(400).json({ 
    error: 'Saknar parametrar',
    usage: 'Använd ?list_id=xxx eller ?task_id=xxx'
  })
}