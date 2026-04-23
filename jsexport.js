// jsexport.js - Gestionnaire de Sauvegardes MASTER (Tous Profils & Modes)
export const exportManager = {
    
    async triggerDownloadOrShare(dataString, fileName) {
        const blob = new Blob([dataString], { type: "text/plain" });
        const url = URL.createObjectURL(blob); 
        const a = document.createElement("a"); a.href = url; a.download = fileName;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); 
        URL.revokeObjectURL(url);
    },

    async exportSaveFile() {
        if(window.ui) window.ui.showToast("📦 Préparation de la MASTER Sauvegarde...");

        let app = window.app;
        
        // 1. Récupération de TOUTES les sessions (IDB brut, sans aucun filtre)
        let allRawSessions = await app.idb.getAllRaw();

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

        let allSessions = allRawSessions.map(enrichSession);
        
        // 2. Sauvegarde de TOUT le localStorage (Paramètres, Tycoon, Marché, Gami, Stats de TOUS les profils)
        let localData = {};
        for (let i = 0; i < localStorage.length; i++) {
            let key = localStorage.key(i);
            localData[key] = localStorage.getItem(key);
        }

        // 3. Sauvegarde de la Banque et Missions (IndexedDB userData) pour CHAQUE utilisateur
        let allUserData = {};
        for (let user of app.usersList) {
            let data = await app.idb.getUserData(user);
            if (data) allUserData[user] = data;
        }

        let exportData = { 
            appVersion: "Compteur Trafic v7.0 (Master)", 
            exportDate: new Date().toISOString(), 
            localStorageBackup: localData, 
            idbUserData: allUserData,
            sessions: allSessions 
        };
        const dataStr = JSON.stringify(exportData, null, 2);
        await this.triggerDownloadOrShare(dataStr, `Master_Save_${new Date().toISOString().slice(0,10)}.json`);
    },

    importSaveFile(event) {
        const file = event.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                let app = window.app;
                
                // Détection : Rétrocompatibilité ou Master Save ?
                let isMaster = data.localStorageBackup !== undefined;

                if (data.sessions && confirm(`⚠️ Attention : Tu vas écraser TOUTE l'application avec cette sauvegarde. Continuer ?`)) {
                    
                    if(window.ui) window.ui.showToast("📥 Restauration globale en cours...");

                    // 1. Restauration des sessions (On vide ABSOLUMENT TOUTE la base de données sessions)
                    await new Promise(resolve => {
                        let tx = app.idb.db.transaction('sessions', 'readwrite');
                        tx.objectStore('sessions').clear();
                        tx.oncomplete = resolve;
                    });
                    
                    for (let s of data.sessions) { 
                        if (!s.id) s.id = Date.now().toString() + Math.random().toString(); 
                        if (!s.user) s.user = app.currentUser; // Sécurité pour les très vieilles sauvegardes
                        await app.idb.add(s); 
                    }
                    
                    if (isMaster) {
                        // --- MODE MASTER SAVE ---
                        // Restauration LocalStorage (on rase tout et on repeuple)
                        localStorage.clear();
                        for (let key in data.localStorageBackup) {
                            localStorage.setItem(key, data.localStorageBackup[key]);
                        }
                        // Restauration IndexedDB userData (Banque/Gami)
                        if (data.idbUserData) {
                            await new Promise(resolve => {
                                let tx = app.idb.db.transaction('userData', 'readwrite');
                                tx.objectStore('userData').clear();
                                tx.oncomplete = resolve;
                            });
                            for (let user in data.idbUserData) {
                                await app.idb.saveUserData(user, data.idbUserData[user]);
                            }
                        }
                    } else {
                        // --- MODE ANCIENNE SAVE (Rétrocompatibilité si tu charges un vieux fichier) ---
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
                    }
                    
                    alert("✅ Master Sauvegarde restaurée avec succès ! Redémarrage..."); 
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
