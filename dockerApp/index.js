const express = require('express')
const os = require('os')
const app = express()

app.get('/', (req, res) => res.send('Hello World from: ' + os.hostname))
app.listen(3000, () => console.log('Server ready'))
