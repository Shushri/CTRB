require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/v1/health', (req, res) => {
    res.status(200).json({ status: 'ok', version: '1.0' });
});

const authRoutes = require('./routes/authRoutes');
app.use('/api/v1/auth', authRoutes);

const ctrbRoutes = require('./routes/ctrbRoutes');
app.use('/api/v1/ctrb', ctrbRoutes);

const inspectionRoutes = require('./routes/inspectionRoutes');
app.use('/api/v1/inspections', inspectionRoutes);

const assemblyRoutes = require('./routes/assemblyRoutes');
app.use('/api/v1/assembly', assemblyRoutes);

const awsRoutes = require('./routes/awsRoutes');
app.use('/api/v1/photos', awsRoutes);

const analyticsRoutes = require('./routes/analyticsRoutes');
app.use('/api/v1', analyticsRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
