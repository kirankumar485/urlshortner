const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const authRoutes = require('./routes/authRoutes')
const apiRoutes = require('./routes/apiRoutes')

const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml'));


dotenv.config();

const app = express();
app.use(bodyParser.json());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// MongoDB Connection
mongoose
    .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch((err) => console.error('MongoDB connection error:', err));

app.use('/auth', authRoutes)
app.use('/api', apiRoutes)


app.get('/', (req, res) => {
    res.send('<h1>Welcome</h1><a href="/auth/google">Sign in with Google</a>');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
