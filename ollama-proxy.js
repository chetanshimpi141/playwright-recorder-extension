const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const PORT = 3001; // You can change this port if needed

app.use(cors());
app.use(bodyParser.json());

app.post('/api/generate', async (req, res) => {
  const { model, prompt } = req.body;
  try {
    const response = await axios.post('http://localhost:11434/api/generate', {
      model,
      prompt,
      stream: false // disables streaming for easier handling
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.toString() });
  }
});

app.listen(PORT, () => {
  console.log(`Ollama proxy server running on http://localhost:${PORT}`);
}); 