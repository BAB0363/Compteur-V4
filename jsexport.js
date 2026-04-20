// jsexport.js - Gestionnaire de Sauvegardes de l'Empire
export const exportManager = {
    
    async triggerDownloadOrShare(dataString, fileName) {
        const blob = new Blob([dataString], { type: "text/plain" });
        const url = URL.createObjectURL(blob); 
        const a = document.createElement("a"); a.href = url; a.download = fileName;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); 
        URL.revokeObjectURL(url);
    },

    async exportSaveFile() {
        if(window.ui) window.ui.showToast("📦 Préparation de la sauvegarde complète de l'Empire...");

        let app = window.app;
        let truckSessions = await app.idb.getAll('trucks');
        let carSessions = await app.idb.getAll('cars');

        let enrichSession = (s) => {
            let items = s.history ? s.history.filter(h => !h.isEvent) : [];
            let count = items.length;
            let vehPerKm = s.distanceKm > 0 ? +(count / s.distanceKm).toFixed(2) : 0;
            let freqMin = (count > 0 && s.durationSec > 0) ? +(count / (s.durationSec / 60)).toFixed(2) : 0;
            let avgSpeed = s.durationSec > 0 ? +(s.distanceKm / (s.durationSec / 3600)).toFixed(1) : 0;
            let espaceTemps = count > 1 ? +(s.durationSec / count).toFixed(1) : 0;
            let rythmeH = s.durationSec > 0 ? +(count / (s.durationSec / 3600)).toFixed(1) : 0;
            
            let detailAuKm = {};
            let sessionWeight = items.reduce((sum, item) => {
                let fallback = 1350;
                if (s.sessionType === 'trucks') fallback = 18000;
                else if (app.vehicleSpecs[item.type]) fallback = (app.vehicleSpecs[item.type].wMin + app.vehicleSpecs[item.type].wMax) / 2;
                return sum + (item.weight || fallback);
            }, 0);

            if (s.distanceKm > 0 && s.summary) {
               Object.keys(s.summary).forEach(k => {
                  let tot = typeof s.summary[k] === 'object' ? (s.summary[k].fr + s.summary[k].etr) : s.summary[k];
                  if(tot > 0) detailAuKm[k] = +(tot / s.distanceKm).toFixed(2);
               });
            }
            return { ...s, totalCount: count, masseTotaleKg: sessionWeight, scoreParKm: vehPerKm, apparitionsParMinute: freqMin, rythmeParHeure: rythmeH, vitesseMoyenneKmh: avgSpeed, espacementMoyenSec: espaceTemps, detailsAuKm: detailAuKm };
        };

        let allSessions = [...truckSessions.map(enrichSession), ...carSessions.map(enrichSession)];
        
        let globalSummary = { 
            profile: app.currentUser,
            mode: app.currentMode,
            bankBalance: app.bankBalance,
            bankHistory: app.bankHistory,
            bankStats: app.bankStats,
            tycoonState: window.tycoon ? window.tycoon.state : null,
            gamiState: window.gami ? window.gami.state : null,
            marketState: window.market ? window.market.state : null,
            totalSessions: allSessions.length, 
            globalDonneesBrutesCamions: app.globalTruckCounters, 
            globalDonneesBrutesVehicules: app.globalCarCounters,
            analysesPermanentesCamions: app.globalAnaTrucks,
            analysesPermanentesVehicules: app.globalAnaCars
        };

        let exportData = { appVersion: "Compteur Trafic v6.3", exportDate: new Date().toISOString(), globalSummary: globalSummary, sessions: allSessions };
        const dataStr = JSON.stringify(exportData, null, 2);
        await this.triggerDownloadOrShare(dataStr, `Empire_Save_${app.currentUser}_${new Date().toISOString().slice(0,10)}.json`);
    },

    importSaveFile(event) {
        const file = event.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                let app = window.app;
                if (data.sessions && confirm(`⚠️ Attention : Tu vas écraser ta partie actuelle avec cette sauvegarde complète. Continuer ?`)) {
                    
                    if(window.ui) window.ui.showToast("📥 Restauration de l'Empire en cours...");

                    await app.idb.clear('trucks'); await app.idb.clear('cars');
                    for (let s of data.sessions) { 
                        if (!s.id) s.id = Date.now().toString() + Math.random().toString(); 
                        s.user = app.currentUser; 
                        await app.idb.add(s); 
                    }
                    
                    let sum = data.globalSummary;
                    if (sum) {
                        if (sum.globalDonneesBrutesCamions) app.storage.set('globalTruckCounters', sum.globalDonneesBrutesCamions);
                        if (sum.globalDonneesBrutesVehicules) app.storage.set('globalCarCounters', sum.globalDonneesBrutesVehicules);
                        if (sum.analysesPermanentesCamions) app.storage.set('globalAnaTrucks', sum.analysesPermanentesCamions);
                        if (sum.analysesPermanentesVehicules) app.storage.set('globalAnaCars', sum.analysesPermanentesVehicules);
                        
                        if (sum.bankBalance !== undefined) app.bankBalance = parseFloat(sum.bankBalance);
                        if (sum.bankHistory !== undefined) app.bankHistory = sum.bankHistory;
                        if (sum.bankStats !== undefined) app.bankStats = sum.bankStats;
                        
                        if (sum.tycoonState && window.tycoon) {
                            window.tycoon.state = sum.tycoonState;
                            window.tycoon.saveState();
                        }
                        if (sum.gamiState && window.gami) {
                            window.gami.state = sum.gamiState;
                            window.gami.saveState();
                        }
                        if (sum.marketState && window.market) {
                            window.market.state = sum.marketState;
                            window.market.saveState();
                        }
                        await app.saveUserData();
                    }
                    
                    alert("✅ Ton Empire, tes missions et ton historique ont été restaurés avec succès ! Redémarrage..."); 
                    location.reload();
                } else if(!data.sessions) { 
                    alert("❌ Format non reconnu."); 
                }
            } catch (err) { 
                alert("❌ Fichier invalide ou corrompu !"); 
            }
        }; 
        reader.readAsText(file);
    }
};

window.exportManager = exportManager;
