/**
 * Vercel Serverless Function: /api/save-inspection
 * Salva la fotografia e i dati statistici su Firebase (Firestore e Storage)
 * in modo completamente sicuro sul server, senza esporre alcuna chiave API al client.
 */

const https = require('https');

const FIREBASE_CONFIG = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyAEROCv8lYbMaxDVhg4u4kcfjGPO2UZL2M",
  projectId: process.env.FIREBASE_PROJECT_ID || "app-create-con-ai",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "app-create-con-ai.firebasestorage.app"
};

function httpsRequest(url, options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

    const {
      type,
      groupId,
      chain,
      shopId,
      shop,
      exId,
      exTitle,
      agent,
      notes,
      cartellini,
      riparazioni,
      imageBase64
    } = req.body || {};

    const timestamp = new Date().toISOString();
    const dateStr = timestamp.split('T')[0];

    // Gestione salvataggio visita completata
    if (type === 'visit_completed') {
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/visits?key=${FIREBASE_CONFIG.apiKey}`;
      const docFields = {
        agent: { stringValue: agent || 'Agente' },
        chain: { stringValue: chain || 'Catena' },
        groupId: { stringValue: String(groupId || '') },
        shop: { stringValue: shop || 'Punto Vendita' },
        shopId: { stringValue: String(shopId || '') },
        cartellini: { booleanValue: !!cartellini },
        riparazioni: { booleanValue: !!riparazioni },
        timestamp: { timestampValue: timestamp },
        date: { stringValue: dateStr },
        status: { stringValue: 'visit_completed' }
      };

      // 1. Log nella collezione 'visits'
      await httpsRequest(firestoreUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, JSON.stringify({ fields: docFields }));

      // 2. Aggiorna documento punto vendita in 'shop_visits'
      if (shopId) {
        const shopVisitUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/shop_visits/${shopId}?key=${FIREBASE_CONFIG.apiKey}`;
        await httpsRequest(shopVisitUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' }
        }, JSON.stringify({ fields: docFields }));
      }

      return res.status(200).json({ success: true, type: 'visit_completed', date: dateStr, timestamp });
    }

    let photoUrl = null;

    // 1. Prova upload su Firebase Storage
    if (imageBase64) {
      try {
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const filename = `inspections/${Date.now()}_${shopId || '0'}_${exId || '0'}.jpg`;
        const encodedFilename = encodeURIComponent(filename);

        const storageUrl = `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_CONFIG.storageBucket}/o?name=${encodedFilename}&key=${FIREBASE_CONFIG.apiKey}`;
        const uploadRes = await httpsRequest(storageUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'image/jpeg',
            'Content-Length': buffer.length
          }
        }, buffer);

        if (uploadRes.status === 200) {
          const parsed = JSON.parse(uploadRes.body);
          photoUrl = `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_CONFIG.storageBucket}/o/${encodedFilename}?alt=media`;
        }
      } catch (storageErr) {
        console.warn("Storage upload non riuscito, salvataggio foto in Firestore:", storageErr.message);
      }
    }

    // 2. Salva documento statistico e fotografico in Cloud Firestore
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/inspections?key=${FIREBASE_CONFIG.apiKey}`;

    const docFields = {
      agent: { stringValue: agent || 'Agente' },
      chain: { stringValue: chain || 'Catena' },
      groupId: { stringValue: String(groupId || '') },
      shop: { stringValue: shop || 'Punto Vendita' },
      shopId: { stringValue: String(shopId || '') },
      exTitle: { stringValue: exTitle || 'Espositore' },
      exId: { stringValue: String(exId || '') },
      timestamp: { timestampValue: timestamp },
      date: { stringValue: dateStr },
      notes: { stringValue: notes || '' },
      status: { stringValue: 'completed' }
    };

    if (photoUrl) {
      docFields.photoUrl = { stringValue: photoUrl };
    } else if (imageBase64) {
      // Se Firebase Storage non è ancora abilitato in console, conserva la foto direttamente in Firestore
      docFields.photoBase64 = { stringValue: imageBase64 };
    }

    const firestoreRes = await httpsRequest(firestoreUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({ fields: docFields }));

    if (firestoreRes.status >= 200 && firestoreRes.status < 300) {
      const created = JSON.parse(firestoreRes.body);
      return res.status(200).json({
        success: true,
        id: created.name ? created.name.split('/').pop() : null,
        photoUrl: photoUrl || 'firestore_inline',
        timestamp
      });
    } else {
      console.error("Errore scrittura Firestore:", firestoreRes.status, firestoreRes.body);
      return res.status(500).json({ error: 'Firestore write failed', details: firestoreRes.body });
    }

  } catch (error) {
    console.error("Errore save-inspection:", error);
    return res.status(500).json({ error: error.message });
  }
};
