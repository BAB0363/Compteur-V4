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
        return { top3: res.sort((a, b) => b.confidence - a.confidence).slice(0, 3) };
    }
};
window.ml = ml;
