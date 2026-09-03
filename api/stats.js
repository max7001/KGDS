/**
 * Vercel Serverless Function: /api/stats
 * Recupera i dati statistici aggregati e gli allestimenti registrati su Firebase (Firestore)
 * senza esporre alcuna chiave API al client.
 */

const https = require('https');

const FIREBASE_CONFIG = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyAEROCv8lYbMaxDVhg4u4kcfjGPO2UZL2M",
  projectId: process.env.FIREBASE_PROJECT_ID || "app-create-con-ai"
};

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    }).on('error', reject);
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/inspections?pageSize=100&key=${FIREBASE_CONFIG.apiKey}`;

    const resp = await httpsGet(firestoreUrl);
    if (resp.status !== 200) {
      return res.status(200).json({
        totalInspections: 0,
        recentInspections: [],
        inspectionsByChain: {},
        inspectionsByAgent: {}
      });
    }

    const data = JSON.parse(resp.body);
    const rawDocs = data.documents || [];

    const inspections = rawDocs.map(doc => {
      const f = doc.fields || {};
      const id = doc.name ? doc.name.split('/').pop() : '';
      return {
        id,
        agent: f.agent?.stringValue || 'Agente',
        chain: f.chain?.stringValue || 'Catena',
        shop: f.shop?.stringValue || 'Punto Vendita',
        exTitle: f.exTitle?.stringValue || 'Espositore',
        timestamp: f.timestamp?.timestampValue || f.timestamp?.stringValue || '',
        date: f.date?.stringValue || '',
        photoUrl: f.photoUrl?.stringValue || f.photoBase64?.stringValue || null,
        notes: f.notes?.stringValue || ''
      };
    });

    // Ordina per timestamp decrescente
    inspections.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

    const inspectionsByChain = {};
    const inspectionsByAgent = {};

    inspections.forEach(it => {
      inspectionsByChain[it.chain] = (inspectionsByChain[it.chain] || 0) + 1;
      inspectionsByAgent[it.agent] = (inspectionsByAgent[it.agent] || 0) + 1;
    });

    // Ultimi 10 scatti con foto miniatura
    const recentInspections = inspections.slice(0, 10).map(it => ({
      id: it.id,
      agent: it.agent,
      chain: it.chain,
      shop: it.shop,
      exTitle: it.exTitle,
      timestamp: it.timestamp,
      date: it.date,
      photoUrl: it.photoUrl
    }));

    return res.status(200).json({
      totalInspections: inspections.length,
      recentInspections,
      inspectionsByChain,
      inspectionsByAgent
    });

  } catch (err) {
    console.error("Errore stats Firebase:", err);
    return res.status(500).json({ error: err.message });
  }
};
