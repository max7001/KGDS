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
    const inspectionsUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/inspections?pageSize=100&key=${FIREBASE_CONFIG.apiKey}`;
    const visitsUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/visits?pageSize=100&key=${FIREBASE_CONFIG.apiKey}`;
    const shopVisitsUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/shop_visits?pageSize=100&key=${FIREBASE_CONFIG.apiKey}`;

    const [respInspections, respVisits, respShopVisits] = await Promise.all([
      httpsGet(inspectionsUrl).catch(() => ({ status: 500 })),
      httpsGet(visitsUrl).catch(() => ({ status: 500 })),
      httpsGet(shopVisitsUrl).catch(() => ({ status: 500 }))
    ]);

    // 1. Scatti fotografici
    let inspections = [];
    if (respInspections.status === 200) {
      const data = JSON.parse(respInspections.body || '{}');
      const rawDocs = data.documents || [];
      inspections = rawDocs.map(doc => {
        const f = doc.fields || {};
        const id = doc.name ? doc.name.split('/').pop() : '';
        return {
          id,
          agent: f.agent?.stringValue || 'Agente',
          chain: f.chain?.stringValue || 'Catena',
          shop: f.shop?.stringValue || 'Punto Vendita',
          shopId: f.shopId?.stringValue || '',
          groupId: f.groupId?.stringValue || '',
          exTitle: f.exTitle?.stringValue || 'Espositore',
          timestamp: f.timestamp?.timestampValue || f.timestamp?.stringValue || '',
          date: f.date?.stringValue || '',
          photoUrl: f.photoUrl?.stringValue || f.photoBase64?.stringValue || null
        };
      });
      inspections.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    }

    // 2. Visite completate
    let visits = [];
    if (respVisits.status === 200) {
      const data = JSON.parse(respVisits.body || '{}');
      const rawDocs = data.documents || [];
      visits = rawDocs.map(doc => {
        const f = doc.fields || {};
        const id = doc.name ? doc.name.split('/').pop() : '';
        return {
          id,
          agent: f.agent?.stringValue || 'Agente',
          chain: f.chain?.stringValue || 'Catena',
          shop: f.shop?.stringValue || 'Punto Vendita',
          shopId: f.shopId?.stringValue || '',
          groupId: f.groupId?.stringValue || '',
          cartellini: !!f.cartellini?.booleanValue,
          riparazioni: !!f.riparazioni?.booleanValue,
          timestamp: f.timestamp?.timestampValue || f.timestamp?.stringValue || '',
          date: f.date?.stringValue || ''
        };
      });
      visits.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    }

    // 3. Mappa date ultima visita per Punto Vendita e Catena
    const shopVisits = {};
    const chainLastVisits = {};

    if (respShopVisits.status === 200) {
      const data = JSON.parse(respShopVisits.body || '{}');
      const rawDocs = data.documents || [];
      rawDocs.forEach(doc => {
        const f = doc.fields || {};
        const sId = f.shopId?.stringValue || (doc.name ? doc.name.split('/').pop() : '');
        if (sId) {
          shopVisits[sId] = {
            shopId: sId,
            shop: f.shop?.stringValue || '',
            chain: f.chain?.stringValue || '',
            groupId: f.groupId?.stringValue || '',
            date: f.date?.stringValue || '',
            timestamp: f.timestamp?.timestampValue || f.timestamp?.stringValue || '',
            agent: f.agent?.stringValue || ''
          };
        }
      });
    }

    // Integra con visite storiche
    visits.forEach(v => {
      if (v.shopId && (!shopVisits[v.shopId] || new Date(v.timestamp) > new Date(shopVisits[v.shopId].timestamp || 0))) {
        shopVisits[v.shopId] = {
          shopId: v.shopId,
          shop: v.shop,
          chain: v.chain,
          groupId: v.groupId,
          date: v.date,
          timestamp: v.timestamp,
          agent: v.agent
        };
      }
      if (v.groupId && (!chainLastVisits[v.groupId] || new Date(v.timestamp) > new Date(chainLastVisits[v.groupId].timestamp || 0))) {
        chainLastVisits[v.groupId] = {
          groupId: v.groupId,
          chain: v.chain,
          shop: v.shop,
          date: v.date,
          timestamp: v.timestamp
        };
      }
    });

    const inspectionsByChain = {};
    const inspectionsByAgent = {};

    inspections.forEach(it => {
      inspectionsByChain[it.chain] = (inspectionsByChain[it.chain] || 0) + 1;
      inspectionsByAgent[it.agent] = (inspectionsByAgent[it.agent] || 0) + 1;
    });

    return res.status(200).json({
      totalInspections: inspections.length,
      totalVisits: visits.length,
      recentInspections: inspections.slice(0, 10),
      recentVisits: visits.slice(0, 10),
      shopVisits,
      chainLastVisits,
      inspectionsByChain,
      inspectionsByAgent
    });

  } catch (err) {
    console.error("Errore stats Firebase:", err);
    return res.status(500).json({ error: err.message });
  }
};
