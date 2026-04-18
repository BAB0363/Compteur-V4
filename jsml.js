// jsml.js - Gégé 2.0 : Apprentissage Spatial et Séquentiel
export const ml = {
    modelTrucks: null,
    modelCars: null,
    isTraining: false,
    worker: null,

    roadMap: { "Inconnu": 0, "Ville (0-50 km/h)": 1, "Route (50-100 km/h)": 2, "Autoroute (>100 km/h)": 3 },
    truckBrands: ["Renault Trucks", "Mercedes-Benz", "Volvo Trucks", "Scania", "DAF", "MAN", "Iveco", "Ford Trucks"],
    carTypes: ["Voitures", "Utilitaires", "Motos", "Camions", "Camping-cars", "Bus/Car", "Engins agricoles", "Vélos"],

    getTruckClasses() {
        let classes = [];
        this.truckBrands.forEach(b => { classes.push(b + "_fr"); classes.push(b + "_etr"); });
        return classes;
    },

    async init() {
        if (typeof tf === 'undefined') return;
        this.initWorker();
        await this.loadModels();
        this.updateUIStatus();
    },

    initWorker() {
        if (window.Worker) {
            this.worker = new Worker('jsml-worker.js');
            this.worker.onmessage = async (e) => {
                const { success } = e.data;
                this.isTraining = false;
                if (success) {
                    await this.loadModels();
                    this.updateUIStatus();
                    if(window.ui) window.ui.showToast(`✨ Gégé a mémorisé tes nouvelles routes !`);
                }
            };
        }
    },

    async loadModels() {
        try { this.modelTrucks = await tf.loadLayersModel('indexeddb://model-trucks'); } catch (e) { this.modelTrucks = null; }
        try { this.modelCars = await tf.loadLayersModel('indexeddb://model-cars'); } catch (e) { this.modelCars = null; }
    },

    updateUIStatus() {
        let elTrucks = document.getElementById('ai-status-trucks'), elCars = document.getElementById('ai-status-cars');
        if (elTrucks) { elTrucks.innerText = this.modelTrucks ? "Prêt ✅" : "Apprentissage requis ❌"; elTrucks.style.color = this.modelTrucks ? "#27ae60" : "#e74c3c"; }
        if (elCars) { elCars.innerText = this.modelCars ? "Prêt ✅" : "Apprentissage requis ❌"; elCars.style.color = this.modelCars ? "#27ae60" : "#e74c3c"; }
    },

    async forceTraining() {
        if (this.isTraining || !this.worker) {
            if(window.ui) window.ui.showToast("⏳ Un entraînement est déjà en cours ou le cerveau n'est pas prêt.");
            return;
        }
        
        let uiProgress = document.getElementById('ai-training-progress');
        if (uiProgress) uiProgress.style.display = 'block';

        if(window.ui) window.ui.showToast("🧠 Début de l'apprentissage de tes zones GPS...");

        this.trainModel('trucks');
        setTimeout(() => this.trainModel('cars'), 500); 
    },

    // ==========================================
    // 🧠 NOUVELLES FONCTIONS DE GÉGÉ
    // ==========================================

    checkAnomaly(mode, vehType, speedKmh, recentHist) {
        // Règle 1 : Un tracteur à pleine vitesse
        if (vehType === 'Engins agricoles' && speedKmh > 90) {
            return { msg: `🚜 Un tracteur à ${Math.round(speedKmh)} km/h ? Tu as vu Flash McQueen !`, type: "anomaly" };
        }
        
        // Règle 2 : Un vélo sur l'autoroute
        if (vehType === 'Vélos' && speedKmh > 100) {
            return { msg: "🚲 Un vélo sur l'autoroute ? Attention les yeux !", type: "anomaly" };
        }

        // Règle 3 : Trop de véhicules identiques d'affilée (Spam)
        let consecutive = 0;
        for (let i = recentHist.length - 1; i >= 0; i--) {
            let t = mode === 'trucks' ? recentHist[i].brand : recentHist[i].type;
            if (t === vehType) consecutive++; 
            else break;
        }
        if (consecutive >= 12) {
            return { msg: `🤔 ${consecutive} ${vehType} d'affilée... Gégé a des doutes !`, type: "anomaly" };
        }

        return null; // Tout est normal, pas d'anomalie
    },

    generateInsights(type, anaData) {
        if (!anaData || !anaData.hours) return "Gégé a besoin de plus de données pour réfléchir... 😴";
        
        // Trouver l'heure où tu as compté le plus de véhicules
        let maxHour = Object.keys(anaData.hours).reduce((a, b) => anaData.hours[a] > anaData.hours[b] ? a : b);
        
        if (anaData.hours[maxHour] === 0) return "Roule un peu, je n'ai rien à analyser ! 🛣️";
        
        return `💡 <strong>Astuce de Gégé :</strong> Ton pic de trafic historique semble être autour de <strong>${maxHour}</strong>. Essaie de rouler à d'autres heures si tu veux éviter les embouteillages !`;
    },

    generateReportCard(type, anaData) {
        if (!anaData || !anaData.predictions) return "Pas encore de note, passe ton permis d'abord ! 🎓";
        
        let total = anaData.predictions.total || 0;
        let success = anaData.predictions.success || 0;
        
        if (total < 10) return "<p style='text-align:center; color:#7f8c8d;'>Continue de compter, je n'ai pas assez de données pour te noter ! 📚</p>";

        let pct = Math.round((success / total) * 100);
        let grade = pct >= 85 ? "A+ 🥇" : pct >= 65 ? "B 🥈" : pct >= 40 ? "C 🥉" : "D 🤡";
        let color = pct >= 65 ? "var(--success-color)" : "var(--danger-color)";
        
        return `
            <div style="text-align: center;">
                <div style="font-size: 3.5em; font-weight: bold; color: ${color}; text-shadow: 0 4px 10px rgba(0,0,0,0.2);">${grade}</div>
                <div style="margin-top: 10px; font-size: 1.1em;">Précision globale de l'IA : <strong style="color:${color};">${pct}%</strong></div>
                <div style="font-size: 0.85em; color: #7f8c8d; margin-top: 8px;">Basé sur ${total} prédictions testées.</div>
            </div>
        `;
    },

    // ==========================================

    extractFeatures(h, recentHistory, labelsList, type) {
        const d = new Date(h.timestamp);
        const hour = d.getHours() / 24.0;
        const day = d.getDay() / 7.0;
        
        // 🛰️ Normalisation spatiale (France approx)
        const lat = ((h.lat || 46) - 41) / 10;
        const lon = ((h.lon || 2) + 5) / 15;
        
        const speed = Math.min((h.speed || 0) / 130.0, 1.0);
        const road = (this.roadMap[h.road || "Inconnu"] || 0) / 3.0;

        const getPrev = (offset) => {
            if (!recentHistory || recentHistory.length < offset) return 0;
            const prev = recentHistory[recentHistory.length - offset];
            const txt = type === 'trucks' ? (prev.brand + '_' + prev.type) : prev.type;
            const idx = labelsList.indexOf(txt);
            return idx !== -1 ? (idx + 1) / (labelsList.length + 1) : 0;
        };

        const tenMins = h.timestamp - 600000;
        const tendance = Math.min(recentHistory.filter(i => i.timestamp >= tenMins).length / 50.0, 1.0);

        // 11 entrées pour Gégé
        return [hour, day, lat, lon, speed, road, getPrev(1), getPrev(2), getPrev(3), tendance, (h.alt || 0) / 2000.0];
    },

    async trainModel(type) {
        if (this.isTraining || !this.worker) return false;
        let sessions = await window.app.idb.getAll(type);
        let live = type === 'trucks' ? window.app.truckHistory : window.app.carHistory;
        let all = [];
        sessions.forEach(s => { if (s.history) all = all.concat(s.history.filter(h => !h.isEvent)); });
        all = all.concat(live.filter(h => !h.isEvent));

        if (all.length < 30) return false;

        let labelsList = type === 'trucks' ? this.getTruckClasses() : this.carTypes;
        let features = [], labels = [];

        for (let i = 0; i < all.length; i++) {
            let h = all[i], txt = type === 'trucks' ? (h.brand + '_' + h.type) : h.type;
            let idx = labelsList.indexOf(txt);
            if (idx !== -1 && h.timestamp) {
                features.push(this.extractFeatures(h, all.slice(Math.max(0, i - 10), i), labelsList, type));
                labels.push(idx);
            }
        }

        this.isTraining = true;
        this.worker.postMessage({ type, features, labels, numClasses: labelsList.length });
        return true;
    },

    async predictNext(type) {
        let model = type === 'trucks' ? this.modelTrucks : this.modelCars;
        if (!model) return null;
        let labelsList = type === 'trucks' ? this.getTruckClasses() : this.carTypes;
        let speed = window.gps ? window.gps.getSlidingSpeedKmh() : 0;
        let recent = (type === 'trucks' ? window.app.truckHistory : window.app.carHistory).filter(h => !h.isEvent);
        
        let mock = {
            timestamp: Date.now(), speed: speed,
            lat: window.gps && window.gps.currentPos ? window.gps.currentPos.lat : 0,
            lon: window.gps && window.gps.currentPos ? window.gps.currentPos.lon : 0,
            alt: window.gps && window.gps.currentPos ? window.gps.currentPos.alt : 0,
            road: window.app.getRoadType(speed, window.app.currentMode)
        };

        const input = tf.tensor2d([this.extractFeatures(mock, recent, labelsList, type)]);
        const pred = model.predict(input);
        const scores = await pred.data();
        input.dispose(); pred.dispose();

        let res = [];
        for (let i = 0; i < scores.length; i++) res.push({ candidate: labelsList[i], confidence: Math.round(scores[i] * 100) });
        // 🧠 Envoi des pensées de Gégé vers le moniteur
        let top3 = res.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
        if (window.ui && window.ui.updateGegeBrain) {
            let currentFeatures = this.extractFeatures(mock, recent, labelsList, type);
            window.ui.updateGegeBrain(currentFeatures, top3);
        }

        return { top3: res.sort((a, b) => b.confidence - a.confidence).slice(0, 3) };
    }
};
window.ml = ml;
