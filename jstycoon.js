// jstycoon.js - Gestion avancée de l'Empire (Flotte, Usure, Carburant, Logistique, Rentabilité)
export const tycoon = {
    state: {
        warehouseLevel: 0,
        storedFreight: 0,
        companyCarbon: 0,
        companyQuota: 0, 
        carbonModifier: 1.0,
        lastResetWeek: 0,
        buildings: {}, 

        fleet: [], 
        pendingIncome: 0,
        purchaseHistory: []
     }, 

    warehouseConfig: {
        levels: [
            { name: "Aucun", cap: 0, price: 0 },
            { name: "Hangar de Proximité", cap: 150, price: 20000 },
            { name: "Entrepôt Régional", cap: 750, price: 80000 },
            { name: "Plateforme Multimodale", cap: 2500, price: 250000 },
            { name: "Hub International", cap: 10000, price: 750000 }
        ]
    },

        catalog: {
        buildings: {
            local_velo: { id: 'local_velo', name: 'Local Vélo', price: 1000, slots: 4, storage: 5, icon: '🚲', maxLimit: 5, targetVeh: 'velo' },
            hub_cargo: { id: 'hub_cargo', name: 'Hub Cargo', price: 2500, slots: 3, storage: 15, icon: '🚴‍♂️', maxLimit: 5, targetVeh: 'cargo' },
            relais_scooter: { id: 'relais_scooter', name: 'Relais Scooter', price: 4000, slots: 2, storage: 10, icon: '🛵', maxLimit: 5, targetVeh: 'scooter' },
            hangar_urbain: { id: 'hangar_urbain', name: 'Hangar Urbain', price: 28000, slots: 3, storage: 100, icon: '🚐', maxLimit: 4, targetVeh: 'utilitaire' },
            depot_periurbain: { id: 'depot_periurbain', name: 'Dépôt Périurbain', price: 50000, slots: 2, storage: 400, icon: '🚚', maxLimit: 4, targetVeh: 'petit_porteur' },
            quai_regional: { id: 'quai_regional', name: 'Quai Régional', price: 80000, slots: 2, storage: 800, icon: '🚛', maxLimit: 3, targetVeh: 'porteur' },
            plateforme: { id: 'plateforme', name: 'Plateforme Logistique', price: 150000, slots: 2, storage: 2500, icon: '🏢', maxLimit: 2, targetVeh: 'ensemble' }
        },
        fleet: {
            velo: { id: 'velo', name: 'Vélo', price: 500, income: 0.002, capacity: 0.02, deliveryKm: 5, icon: '🚲', buildingId: 'local_velo', tireLifeKm: 3000, fuelTank: 1, l100: 0, serviceInterval: 2000 },
            cargo: { id: 'cargo', name: 'Vélo Cargo', price: 1500, income: 0.005, capacity: 0.10, deliveryKm: 10, icon: '🚴‍♂️', buildingId: 'hub_cargo', tireLifeKm: 5000, fuelTank: 1, l100: 0, serviceInterval: 3000 },
            scooter: { id: 'scooter', name: 'Scooter', price: 2500, income: 0.008, capacity: 0.06, deliveryKm: 4, icon: '🛵', buildingId: 'relais_scooter', tireLifeKm: 8000, fuelTank: 7, l100: 3, serviceInterval: 5000 },
            utilitaire: { id: 'utilitaire', name: 'Utilitaire', price: 18000, income: 0.010, capacity: 0.80, deliveryKm: 40, icon: '🚐', buildingId: 'hangar_urbain', tireLifeKm: 45000, fuelTank: 80, l100: 8, serviceInterval: 15000 },
            petit_porteur: { id: 'petit_porteur', name: 'Petit Porteur', price: 35000, income: 0.025, capacity: 4.00, deliveryKm: 80, icon: '🚚', buildingId: 'depot_periurbain', tireLifeKm: 120000, fuelTank: 200, l100: 16, serviceInterval: 25000 },
            porteur: { id: 'porteur', name: 'Porteur 19t', price: 55000, income: 0.040, capacity: 8.00, deliveryKm: 100, icon: '🚛', buildingId: 'quai_regional', tireLifeKm: 150000, fuelTank: 300, l100: 22, serviceInterval: 30000 },
            ensemble: { id: 'ensemble', name: 'Ensemble Routier', price: 130000, income: 0.080, capacity: 24.00, deliveryKm: 200, icon: '🛣️', buildingId: 'plateforme', tireLifeKm: 200000, fuelTank: 1000, l100: 32, serviceInterval: 50000 }
        }
    },


        fuelPrice: 1.80,
    sessionFreightToAdd: 0,

    init() {

        this.loadState();
    },

        loadState() {
        let user = window.app && window.app.currentUser ? window.app.currentUser : 'Sylvain';
        let saved = localStorage.getItem(`tycoon_state_${user}`);
        if (saved) {
            try { this.state = { ...this.state, ...JSON.parse(saved) }; }
            catch(e) { console.error("Erreur de lecture Tycoon"); }
        }
        
                 // --- INFLATION À LA POMPE (Journalière) ---
        let d = new Date();
        let todayStr = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
        if (this.state.lastFuelDate !== todayStr || !this.state.fuelPrice) {
            this.state.fuelPrice = parseFloat((1.40 + Math.random() * 1.10).toFixed(2));
            this.state.lastFuelDate = todayStr;
            this.saveState();
        }



        
        if (this.state.fleet) {
            this.state.fleet.forEach(v => {
                let def = this.catalog.fleet[v.type];
                if (def) {
                    if (v.fuel > def.fuelTank) v.fuel = def.fuelTank;
                    if (v.tires > 100) v.tires = 100;
                    if (v.health > 100) v.health = 100;
                    if (v.gains === undefined) v.gains = 0; 
                    if (v.losses === undefined) v.losses = 0;
                }
            });
        }
        
        this.checkWeeklyCarbon();
    },

    saveState() {
        let user = window.app && window.app.currentUser ? window.app.currentUser : 'Sylvain';
        localStorage.setItem(`tycoon_state_${user}`, JSON.stringify(this.state));
    },

    getFleetStatus() {
        let availableFleet = this.state.fleet.filter(v => v.health > 20 && v.fuel > 0);
        availableFleet.sort((a, b) => this.catalog.fleet[b.type].capacity - this.catalog.fleet[a.type].capacity);

        let remainingFreight = this.state.storedFreight;
        let deliveringVehicles = [];
        let passiveVehicles = [];

        availableFleet.forEach(veh => {
            let cap = this.catalog.fleet[veh.type].capacity;
            if (remainingFreight > 0) {
                deliveringVehicles.push(veh);
                remainingFreight -= cap; 
            } else {
                passiveVehicles.push(veh);
            }
        });

        return { deliveringVehicles, passiveVehicles };
    },

        getWarehouseCapacity() {
        let totalStorage = 0;
        Object.keys(this.state.buildings).forEach(id => {
            if (this.catalog.buildings[id]) {
                totalStorage += (this.state.buildings[id] || 0) * this.catalog.buildings[id].storage;
            }
        });
        return totalStorage;
    },


    getWeekNumber() {
        let d = new Date();
        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
        let yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
        return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
    },

    checkWeeklyCarbon() {
        let currentWeek = this.getWeekNumber();
        if (!this.state.lastResetWeek) {
            this.state.lastResetWeek = currentWeek;
            return;
        }
        if (currentWeek !== this.state.lastResetWeek) {
            let ratio = this.state.companyQuota > 0 ? (this.state.companyCarbon / this.state.companyQuota) : 1;
            
            if (ratio > 1.0) {
                this.state.carbonModifier = 0.7;
                if(window.ui) window.ui.showToast("🚨 Bilan Hebdo : Malus Carbone (-30% sur les ventes) !");
            } else if (ratio <= 0.8 && this.state.companyCarbon > 0) {
                this.state.carbonModifier = 1.2;
                if(window.ui) window.ui.showToast("🌿 Bilan Hebdo : Bonus Écolo (+20% sur les ventes) !");
            } else {
                this.state.carbonModifier = 1.0;
                if(window.ui) window.ui.showToast("⚖️ Bilan Hebdo : Neutre.");
            }
            
            this.state.companyCarbon = 0; 
            this.state.companyQuota = 0;
            this.state.lastResetWeek = currentWeek;
            this.saveState();
        }
    },

    addCarbon(emitted, quota) {
        this.state.companyCarbon += emitted;
        this.state.companyQuota += quota;
        this.saveState();
    },

        getDynamicPrice() {
        const basePrice = 3.00; // Nouveau prix de base augmenté
        const cap = this.getWarehouseCapacity();
        if (cap === 0) return basePrice;
        const fillRate = this.state.storedFreight / cap;
        
        let price = basePrice;
        if (fillRate < 0.20) price = basePrice * 1.5;
        if (fillRate > 0.80) price = basePrice * 0.5;
        
        return price * (this.state.carbonModifier || 1.0);
    },


    

    getStats() {
        let maxSlots = 0;
        Object.keys(this.state.buildings).forEach(k => {
            if (this.catalog.buildings[k]) {
                maxSlots += (this.state.buildings[k] || 0) * this.catalog.buildings[k].slots;
            }
        });
        
        let usedSlots = this.state.fleet.length;
        let incomePerMin = 0;

        let status = this.getFleetStatus();

        status.passiveVehicles.forEach(veh => {
            let def = this.catalog.fleet[veh.type];
            if (def && veh.fuel > 0 && veh.health > 20) {
                incomePerMin += def.income;
            }
        });

        if ((this.state.buildings.zone || 0) > 0) incomePerMin *= 1.10;
        
        let bonusPct = 0;
        if (usedSlots > 0) {
            if (usedSlots <= 5) bonusPct = usedSlots * 5;
            else if (usedSlots <= 15) bonusPct = 25 + ((usedSlots - 5) * 2);
            else bonusPct = 45 + ((usedSlots - 15) * 0.5);
        }
        if (bonusPct > 50) bonusPct = 50; 
        incomePerMin *= (1 + (bonusPct / 100));

        if (window.app && window.app.bankBalance < 0) {
            incomePerMin = 0; 
        }

        return { maxSlots, usedSlots, incomePerMin };
    },

    getBuildingPrice(id) {
        let item = this.catalog.buildings[id];
        let count = this.state.buildings[id] || 0;
        return Math.floor(item.price * Math.pow(1.20, count)); 
    },

    buyBuilding(id) {
        let item = this.catalog.buildings[id];
        let count = this.state.buildings[id] || 0;
        
        if (count >= item.maxLimit) {
            if(window.ui) window.ui.showToast("🛑 Limite atteinte pour ce type de bâtiment !");
            return;
        }

        let currentPrice = this.getBuildingPrice(id);

        if (window.app.bankBalance < currentPrice) {
            if(window.ui) window.ui.showToast("❌ Fonds insuffisants !");
            return;
        }

        if(confirm(`Investir ${currentPrice.toLocaleString('fr-FR')} € dans : ${item.name} ?`)) {
            window.app.addBankTransaction(-currentPrice, `Achat Immo : ${item.name}`);
            this.state.buildings[id] = count + 1;
            this.state.purchaseHistory.push({ type: 'building', id: id, time: Date.now(), price: currentPrice });
            this.saveState();
            this.renderUI();
            if(window.ui) { window.ui.playGamiSound('cash'); window.ui.showToast(`🏢 Achat réussi !`); }
        }
    },

    buyVehicle(id) {
        let def = this.catalog.fleet[id];
        let buildingId = def.buildingId;
        
        let buildingCount = this.state.buildings[buildingId] || 0;
        let maxSlotsForType = buildingCount * this.catalog.buildings[buildingId].slots;
        let usedSlotsForType = this.state.fleet.filter(v => v.type === id).length;
        
        if (window.app.bankBalance < def.price) {
            if(window.ui) window.ui.showToast("❌ Fonds insuffisants !");
            return;
        }

        if (usedSlotsForType >= maxSlotsForType) {
            let bName = this.catalog.buildings[buildingId].name;
            if(window.ui) window.ui.showToast(`🅿️ Pas de place ! Achète plus de "${bName}".`);
            return;
        }

        if(confirm(`Acheter ${def.name} pour ${def.price.toLocaleString('fr-FR')} € ?`)) {
            window.app.addBankTransaction(-def.price, `Achat Flotte : ${def.name}`);
            let newVeh = {
                uid: 'veh_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                type: id,
                health: 100,
                fuel: def.fuelTank,
                tires: 100,
                kms: 0,
                kmsSinceService: 0,
                gains: 0,
                losses: 0
            };
            this.state.fleet.push(newVeh);
            this.state.purchaseHistory.push({ type: 'fleet', id: id, time: Date.now(), price: def.price });
            this.saveState();
            this.renderUI();
            if(window.ui) { window.ui.playGamiSound('cash'); window.ui.showToast(`🚚 Véhicule ajouté !`); }
        }
    },

    sellVehicle(uid) {
        let index = this.state.fleet.findIndex(v => v.uid === uid);
        if (index === -1) return;
        
        let veh = this.state.fleet[index];
        let item = this.catalog.fleet[veh.type];
        let sellPrice = (item.price * 0.60) * (veh.health / 100);
        
        if(confirm(`Revendre ce ${item.name} pour ${sellPrice.toLocaleString('fr-FR', {maximumFractionDigits:2})} € ?`)) {
            window.app.addBankTransaction(sellPrice, `Revente : ${item.name}`);
            this.state.fleet.splice(index, 1);
            this.saveState();
            this.renderUI();
            if(window.ui) { window.ui.playGamiSound('cash'); window.ui.showToast(`💸 Véhicule revendu !`); }
        }
    },

        refuel(uid) {
        let v = this.state.fleet.find(f => f.uid === uid);
        if (!v) return;
        let def = this.catalog.fleet[v.type];
        let needed = def.fuelTank - v.fuel; 
        if (needed <= 0) return;
        let currentFuelPrice = this.state.fuelPrice || 1.80;
        let cost = needed * currentFuelPrice;

        
        if (window.app.bankBalance < cost) {
            if(window.ui) window.ui.showToast("❌ Pas assez d'argent pour l'essence !");
            return;
        }
        
        window.app.addBankTransaction(-cost, `Plein ${def.name}`, true);
;
        v.fuel = def.fuelTank;
        v.losses = (v.losses || 0) + cost;
        this.saveState();
        this.renderUI();
    },

    changeTires(uid) {
        let v = this.state.fleet.find(f => f.uid === uid);
        if (!v) return;
        let def = this.catalog.fleet[v.type];
        let cost = def.price * 0.04;
        
        if (window.app.bankBalance < cost) {
            if(window.ui) window.ui.showToast("❌ Fonds insuffisants pour les pneus !");
            return;
        }
        
                window.app.addBankTransaction(-cost, `Pneus Neufs ${def.name}`, true);

        v.tires = 100;
        v.losses = (v.losses || 0) + cost;
        this.saveState();
        this.renderUI();
    },

    repair(uid) {
        let v = this.state.fleet.find(f => f.uid === uid);
        if (!v) return;
        let def = this.catalog.fleet[v.type];
        
        let cost = (def.price * 0.08) * ((100 - v.health) / 100);
        if (v.health <= 30) cost *= 3; 
        if (v.kmsSinceService > 0) cost += (def.price * 0.01);
        
        if (window.app.bankBalance < cost) {
            if(window.ui) window.ui.showToast("❌ Pas assez d'argent pour le garage !");
            return;
        }
        
                window.app.addBankTransaction(-cost, `Révision ${def.name}`, true);

        v.health = 100;
        v.kmsSinceService = 0; 
        v.losses = (v.losses || 0) + cost;
        this.saveState();
        this.renderUI();
    },
    rollFreightLottery() {
        if (Math.random() <= 0.15) {
            let randomTons = Math.floor(Math.random() * (25 - 5 + 1)) + 5;
            this.sessionFreightToAdd += randomTons;
            if (window.ui) window.ui.showToast(`📦 Jackpot fret ! +${randomTons}t en attente d'arrivée !`);
        }
    },

    unloadPendingFreight() {
        if (this.sessionFreightToAdd > 0) {
            this.state.storedFreight += this.sessionFreightToAdd;
            let maxCap = this.getWarehouseCapacity();
            if (this.state.storedFreight > maxCap) this.state.storedFreight = maxCap;
            this.saveState();
            if(window.ui) window.ui.showToast(`🏗️ Déchargement réussi : +${this.sessionFreightToAdd}t en stock !`);
            this.sessionFreightToAdd = 0;
        }
    },

    resetPendingFreight() {
        this.sessionFreightToAdd = 0;
    },

        tickDistance(km) {
        if (!this.state.fleet || this.state.fleet.length === 0) return;
        
        // 🚨 MODIFICATION : Le Tycoon ne prend l'usure GPS que si le mode Véhicules est actif !
        if (window.app && !window.app.isCarRunning) return;

        let needsSave = false;

        // --- SMART DISPATCH ---
        if (this.state.storedFreight > 0) {
            let status = this.getFleetStatus();
            let totalDelivered = 0;
            let price = this.getDynamicPrice();

                      status.deliveringVehicles.forEach(veh => {
                let def = this.catalog.fleet[veh.type];
                let power = def.capacity / (def.deliveryKm || 10); 
                let tons = power * km; 

                
                let stockRestant = this.state.storedFreight - totalDelivered;
                if (tons > stockRestant) tons = stockRestant;
                
                if (tons > 0) {
                    totalDelivered += tons;
                    veh.gains = (veh.gains || 0) + (tons * price);
                    needsSave = true;
                }
            });

            if (totalDelivered > 0) {
                let profit = parseFloat((totalDelivered * price).toFixed(2));
                window.app.addBankTransaction(profit, `Livraison Flotte (${totalDelivered.toFixed(1)}t)`);
                this.state.storedFreight -= totalDelivered;
                needsSave = true;
            }
        }
        // --- FIN DU SMART DISPATCH ---

        let cap = this.getWarehouseCapacity();

        let fillRate = cap > 0 ? (this.state.storedFreight / cap) : 0;
        let weightPenalty = 1 + fillRate; 

        this.state.fleet.forEach(veh => {
            let def = this.catalog.fleet[veh.type];
            if (!def) return;

            // 1. On mémorise l'état AVANT l'usure
            let wasWarning = veh.fuel <= (def.fuelTank * 0.3) || veh.health <= 60 || veh.kmsSinceService >= (def.serviceInterval * 0.8);

            veh.kms = (veh.kms || 0) + km;
            veh.kmsSinceService = (veh.kmsSinceService || 0) + km;

            let tireWear = (km / def.tireLifeKm) * 100;
            veh.tires = Math.max(0, (veh.tires || 100) - tireWear);

            let fuelConsumed = (km * (def.l100 / 100)) * weightPenalty;
            veh.fuel = Math.max(0, (veh.fuel || def.fuelTank) - fuelConsumed);

            if (veh.kmsSinceService > def.serviceInterval) {
                let penalty = km * 5; 
                veh.health = Math.max(0, veh.health - penalty);
            }

            if (veh.tires <= 10) {
                let chance = km * 0.05; 
                if (Math.random() < chance) {
                    veh.health = Math.max(0, veh.health - 25);
                    veh.losses = (veh.losses || 0) + 1000;
                    if (window.app) window.app.addBankTransaction(-1000, `💥 Crevaison (${def.name})`);
                    if(window.ui) window.ui.showToast(`💥 Crevaison de ton ${def.name} ! Dépannage : -1000€`, "anomaly");
                }
            }

                      // 2. On vérifie l'état APRÈS l'usure pour afficher l'alerte préventive 🟠
            let isWarning = veh.fuel <= (def.fuelTank * 0.3) || veh.health <= 60 || veh.kmsSinceService >= (def.serviceInterval * 0.8);
            if (!wasWarning && isWarning && window.ui) {
                window.ui.showToast(`🟠 Alerte flotte : Ton ${def.name} passe en zone orange !`, "anomaly");
                window.ui.playGamiSound('siren');
            }


            needsSave = true;
        });
        if (needsSave) this.saveState();
    },

    tickSecond(secondsElapsed) {
        let stats = this.getStats();
        let status = this.getFleetStatus();
        
        if (stats.incomePerMin > 0) {
            this.state.pendingIncome += (stats.incomePerMin / 60);
            let displayPending = document.getElementById('company-pending-income');
            if (displayPending) displayPending.innerText = this.state.pendingIncome.toFixed(2) + ' €';

            let bonusMultiplier = 1.0;
            let usedSlots = this.state.fleet.length;
            if (usedSlots > 0) {
                if (usedSlots <= 5) bonusMultiplier += (usedSlots * 5)/100;
                else if (usedSlots <= 15) bonusMultiplier += (25 + ((usedSlots - 5) * 2))/100;
                else bonusMultiplier += (45 + ((usedSlots - 15) * 0.5))/100;
            }
            if (bonusMultiplier > 1.5) bonusMultiplier = 1.5;
            if ((this.state.buildings.zone || 0) > 0) bonusMultiplier *= 1.10;
            let carbonMod = this.state.carbonModifier || 1.0;

            if (window.app && window.app.bankBalance >= 0) {
                status.passiveVehicles.forEach(veh => {
                    let def = this.catalog.fleet[veh.type];
                    if (!def) return;
                    
                    if (veh.fuel > 0 && veh.health > 20) {
                        veh.gains = (veh.gains || 0) + ((def.income / 60) * bonusMultiplier * carbonMod);
                    }
                });
            }
        }

        if (secondsElapsed > 0 && secondsElapsed % 60 === 0) {
            let needsRender = false;
            this.state.fleet.forEach(veh => {
                let def = this.catalog.fleet[veh.type];
                if (!def) return;

                // 1. Mémorisation de l'état AVANT conso temporelle
                let wasWarning = veh.fuel <= (def.fuelTank * 0.3) || veh.health <= 60 || veh.kmsSinceService >= (def.serviceInterval * 0.8);

                if (veh.fuel > 0) {
                    veh.fuel = Math.max(0, veh.fuel - 0.03); 
                    needsRender = true;
                }

                if (veh.fuel > 0 && veh.health > 20) {
                    let breakdownChance = veh.health > 80 ? 0.001 : (veh.health < 50 ? 0.02 : 0.005);
                    if (Math.random() < breakdownChance) {
                        let isMajor = veh.health < 50 && Math.random() < 0.3;
                        let dmg = isMajor ? 40 : 15;
                        veh.health = Math.max(0, veh.health - dmg);
                        let cost = isMajor ? (def.price * 0.05) : (def.price * 0.01);
                        veh.losses = (veh.losses || 0) + cost;
                        
                                if (window.app) window.app.addBankTransaction(-cost, `🚨 Panne Imprévue (${def.name})`, true);

                        if(window.ui) window.ui.showToast(`🚨 Panne ${isMajor ? 'MAJEURE' : 'mineure'} sur ton ${def.name} ! Frais : -${cost.toFixed(0)}€`, "anomaly");
                        needsRender = true;
                    }
                }

                            // 2. Vérification de l'état APRÈS conso temporelle
        let isWarning = veh.fuel <= (def.fuelTank * 0.3) || veh.health <= 60 || veh.kmsSinceService >= (def.serviceInterval * 0.8);
            if (!wasWarning && isWarning && window.ui) {
                window.ui.showToast(`🟠 Alerte flotte : Ton ${def.name} passe en zone orange !`, "anomaly");
                window.ui.playGamiSound('siren');
            }
            });

            // --- ÉVÉNEMENTS ALÉATOIRES DE L'ENTREPRISE ---
            let stats = this.getStats();
            if (stats.usedSlots > 0 && Math.random() < 0.05) { 
                if (Math.random() > 0.5) {
                    let bonus = Math.round(stats.incomePerMin * 5); 
                    window.app.addBankTransaction(bonus, "🏢 Fret exceptionnel (Entreprise)");
                    if(window.ui) { window.ui.showToast(`🏢 Ton entreprise a décroché un fret express : +${bonus} € !`); window.ui.playGamiSound('cash'); }
                } else {
                    let malus = Math.round(stats.incomePerMin * 3); 
                    window.app.addBankTransaction(-malus, "🏢 Réparation d'urgence (Entreprise)");
                    if(window.ui) { window.ui.showToast(`⚠️ Incident logistique ! Frais : -${malus} €`, 'anomaly'); window.ui.playGamiSound('crash'); }
                }
            }
            
            if (needsRender && window.ui && window.ui.activeTab === 'company') {
                this.renderUI();
            }
            this.saveState();
        }
    },


    cashOut() {
        if (this.state.pendingIncome > 0) {
            let earned = parseFloat(this.state.pendingIncome.toFixed(2));
            if (earned > 0) {
                if (window.app && !window.app.isTruckRunning) window.app.sessionFinance.gains += earned;
                window.app.addBankTransaction(earned, "🏢 Bénéfices Flotte (Passif)");
                if (window.ui) {
                    window.ui.playGamiSound('cash');
                    window.ui.showToast(`🏢 Tes chauffeurs ont généré +${earned} € !`);
                }
            }
            this.state.pendingIncome = 0;
            this.saveState();
            let displayPending = document.getElementById('company-pending-income');
            if (displayPending) displayPending.innerText = '0.00 €';
        }
    },

    renderUI() {
        let stats = this.getStats();
        let status = this.getFleetStatus();
        
        let cap = this.getWarehouseCapacity();
        let levelInfo = this.warehouseConfig.levels[this.state.warehouseLevel];
        let fillPct = cap > 0 ? (this.state.storedFreight / cap) * 100 : 0;

        if(document.getElementById('warehouse-name')) document.getElementById('warehouse-name').innerText = levelInfo ? levelInfo.name : "Aucun";
        if(document.getElementById('warehouse-tons')) document.getElementById('warehouse-tons').innerText = this.state.storedFreight.toFixed(1) + " t";
        if(document.getElementById('warehouse-cap')) document.getElementById('warehouse-cap').innerText = "Capacité max : " + cap + " t";
        if(document.getElementById('warehouse-bar')) document.getElementById('warehouse-bar').style.width = Math.min(100, fillPct) + "%";

        let carbTotal = this.state.companyCarbon || 0;
        let carbQuota = this.state.companyQuota || 0;
        
        let carbFill = carbQuota > 0 ? (carbTotal / carbQuota) * 100 : 0;
        let displayFill = Math.min(100, carbFill); 
        
        if(document.getElementById('company-carb-total')) {
            let totalStr = window.app ? window.app.formatCarbon(carbTotal) : (carbTotal / 1000).toFixed(1) + " kg";
            let quotaStr = window.app ? window.app.formatCarbon(carbQuota) : (carbQuota / 1000).toFixed(1) + " kg";
            document.getElementById('company-carb-total').innerText = totalStr + " / " + quotaStr;
        }

        if(document.getElementById('company-carb-bar')) {
            let bar = document.getElementById('company-carb-bar');
            bar.style.width = displayFill + "%";
            bar.style.backgroundColor = carbFill > 100 ? "#e74c3c" : (carbFill > 80 ? "#f39c12" : "#27ae60");
        }
        if(document.getElementById('company-carb-status-text')) {
            let mod = this.state.carbonModifier || 1.0;
            let statusTxt = "Statut : Neutre ⚖️";
            let statusCol = "#f39c12";
            if (mod > 1.0) { statusTxt = "Statut : Éco-Bonus 🌿"; statusCol = "#27ae60"; }
            if (mod < 1.0) { statusTxt = "Statut : Malus Carbone 🚨"; statusCol = "#e74c3c"; }
            document.getElementById('company-carb-status-text').innerText = statusTxt;
            document.getElementById('company-carb-status-text').style.color = statusCol;
        }

         let btnUp = document.getElementById('btn-upgrade-warehouse');
        if(btnUp) btnUp.style.display = 'none'; // On cache l'ancien bouton

        
        let elSlotsUsed = document.getElementById('company-slots-used');
        let elSlotsMax = document.getElementById('company-slots-max');
        let elRate = document.getElementById('company-rate-display');
        let elPending = document.getElementById('company-pending-income');

        if(elSlotsUsed) elSlotsUsed.innerText = stats.usedSlots;
        if(elSlotsMax) elSlotsMax.innerText = stats.maxSlots === 0 ? "0" : stats.maxSlots;
        
        if(elRate) {
            if (window.app && window.app.bankBalance < 0) {
                elRate.innerHTML = `<span style="color:var(--danger-color);">🚨 GRÈVE DES CHAUFFEURS : 0.00 € / min</span>`;
            } else {
                elRate.innerHTML = `Rythme actuel : + ${stats.incomePerMin.toFixed(2)} € / min`;
            }
        }
        
        if(elPending) elPending.innerText = this.state.pendingIncome.toFixed(2) + ' €';

        let buildList = document.getElementById('company-buildings-list');
        if(buildList) {
            buildList.innerHTML = '';
            buildList.style.display = 'flex';
            buildList.style.flexDirection = 'column';
            buildList.style.gap = '8px';
            Object.keys(this.catalog.buildings).forEach(k => {
                let item = this.catalog.buildings[k];
                let count = this.state.buildings[k] || 0;
                let currentPrice = this.getBuildingPrice(k);
                let isMaxed = count >= item.maxLimit;
                
                let canBuy = window.app && window.app.bankBalance >= currentPrice && !isMaxed;
                let btnTxt = isMaxed ? "Max" : "Investir";
                
                buildList.innerHTML += `
    <div style="background:var(--card-bg); border-radius:6px; padding: 10px 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); display:flex; justify-content:space-between; align-items:center; ${isMaxed ? 'opacity: 0.6;' : ''}">
        <div style="display:flex; flex-direction:column; gap:2px;">
            <span style="font-size:1em; color:var(--text-color);">${item.icon} <b>${item.name}</b></span>
            <span style="font-size:0.75em; color:#7f8c8d;">Places : ${count}/${item.maxLimit} | <b>Stock : +${item.storage}t</b></span>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end;">
            <span style="font-size:0.85em; font-weight:bold; color:var(--text-color); margin-bottom:4px; ${isMaxed ? 'text-decoration: line-through;' : ''}">${currentPrice.toLocaleString('fr-FR')} €</span>
            <button style="background:var(--primary-color); color:white; border:none; padding:4px 10px; border-radius:4px; font-weight:bold; font-size:0.8em;" ${!canBuy ? 'disabled style="background:#bdc3c7;"' : ''} onclick="window.tycoon.buyBuilding('${k}')">${btnTxt}</button>
        </div>
    </div>
`;

            });
        }

        let fleetList = document.getElementById('company-fleet-list');
        if(fleetList) {
            fleetList.className = ''; 
            fleetList.style.display = 'flex';
            fleetList.style.flexDirection = 'column';
            fleetList.style.gap = '8px';
            fleetList.innerHTML = '';
            
            this.state.fleet.forEach(v => {
                let def = this.catalog.fleet[v.type];
                
                let isDelivering = status.deliveringVehicles.some(dv => dv.uid === v.uid);
                let badge = isDelivering ? '📦 LIVRAISON' : '☕ PASSIF';
                let baseColor = isDelivering ? '#27ae60' : '#3498db';
                
                let isCritical = v.fuel <= (def.fuelTank * 0.1) || v.health <= 30 || (v.tires || 100) <= 10;
                let isWarning = v.fuel <= (def.fuelTank * 0.3) || v.health <= 60 || v.kmsSinceService >= (def.serviceInterval * 0.8);
                let color = isCritical ? "#e74c3c" : (isWarning ? "#f39c12" : baseColor);
                let statusTxt = isCritical ? "🔴 ACTION REQUISE" : (isWarning ? "🟠 SURVEILLANCE" : badge);
                
                let sellPrice = (def.price * 0.60) * (v.health / 100);
                
                let vehGains = v.gains || 0;
                let vehLosses = v.losses || 0;
                let vehROI = vehGains - vehLosses;
                let roiColor = vehROI >= 0 ? '#27ae60' : '#e74c3c';
                let roiSign = vehROI > 0 ? '+' : '';

                fleetList.innerHTML += `
                    <div style="background:var(--card-bg); border-left: 5px solid ${color}; border-radius:6px; padding: 10px 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); cursor: pointer; overflow:hidden;" onclick="this.querySelector('.details').style.display = this.querySelector('.details').style.display === 'none' ? 'block' : 'none'">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-size:1.05em; font-weight:bold; color:var(--text-color);">${def.icon} ${def.name} <small style="color:#7f8c8d; font-size:0.8em; font-weight:normal;">#${v.uid.slice(-3)}</small></span>
                            <span style="font-size:0.7em; font-weight:bold; color:white; background:${color}; padding:4px 8px; border-radius:4px;">${statusTxt}</span>
                        </div>
                        
                        <div class="details" style="display:none; margin-top:12px; border-top:1px solid var(--border-color); padding-top:12px;">
                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; font-size:0.85em; margin-bottom: 12px; color:var(--text-color);">
                                <div>⛽ <b>${v.fuel.toFixed(1)} / ${def.fuelTank} L</b></div>
                                <div>🔧 État : <b>${Math.round(v.health)}%</b></div>
                                <div>🛞 Pneus : <b>${Math.round(v.tires || 100)}%</b></div>
                                <div>🛣️ Révis. : <b>${Math.max(0, Math.round(def.serviceInterval - v.kmsSinceService))} km</b></div>
                            </div>
                            
                            <div style="margin-bottom: 12px; border-top: 1px dashed var(--border-color); padding-top: 8px;">
                                <div style="display:flex; justify-content:space-between; font-size:0.85em;">
                                    <span style="color:#7f8c8d;">📈 Bénéfices (Passifs + Fret)</span>
                                    <span style="color:#27ae60; font-weight:bold;">+${vehGains.toLocaleString('fr-FR', {maximumFractionDigits:2})} €</span>
                                </div>
                                <div style="display:flex; justify-content:space-between; font-size:0.85em; margin-top:2px;">
                                    <span style="color:#7f8c8d;">📉 Frais (Pompe, Garage...)</span>
                                    <span style="color:#e74c3c; font-weight:bold;">-${vehLosses.toLocaleString('fr-FR', {maximumFractionDigits:2})} €</span>
                                </div>
                                <div style="display:flex; justify-content:space-between; font-size:0.95em; margin-top:5px; padding-top:5px; border-top: 1px solid rgba(0,0,0,0.05);">
                                    <span style="color:var(--text-color); font-weight:bold;">💰 Bilan Net</span>
                                    <span style="color:${roiColor}; font-weight:bold;">${roiSign}${vehROI.toLocaleString('fr-FR', {maximumFractionDigits:2})} €</span>
                                </div>
                            </div>

                                                       <div style="display:flex; gap:6px;">
                                <button style="flex:1; background:#27ae60; color:white; border:none; padding:8px; border-radius:4px; font-weight:bold; font-size:0.9em;" onclick="event.stopPropagation(); window.tycoon.refuel('${v.uid}')">⛽ Plein (${(this.state.fuelPrice || 1.80).toFixed(2)}€/L)</button>
                                <button style="flex:1; background:#3498db; color:white; border:none; padding:8px; border-radius:4px; font-weight:bold; font-size:0.9em;" onclick="event.stopPropagation(); window.tycoon.repair('${v.uid}')">🔧 Révis.</button>
                                <button style="flex:1; background:#8e44ad; color:white; border:none; padding:8px; border-radius:4px; font-weight:bold; font-size:0.9em;" onclick="event.stopPropagation(); window.tycoon.changeTires('${v.uid}')">🛞 Pneus</button>
                            </div>

                            <button style="margin-top:6px; background:var(--danger-color); color:white; border:none; border-radius:4px; padding:8px; font-weight:bold; cursor:pointer; width:100%; font-size:0.9em;" onclick="event.stopPropagation(); window.tycoon.sellVehicle('${v.uid}')">Revendre (${sellPrice.toLocaleString('fr-FR', {maximumFractionDigits:0})} €)</button>
                        </div>
                    </div>
                `;
            });
            
            Object.keys(this.catalog.fleet).forEach(k => {
                let item = this.catalog.fleet[k];
                let bId = item.buildingId;
                let maxSlots = (this.state.buildings[bId] || 0) * this.catalog.buildings[bId].slots;
                let currentUsed = this.state.fleet.filter(v => v.type === k).length;
                
                let isFull = currentUsed >= maxSlots;
                let canBuy = window.app.bankBalance >= item.price && !isFull;
                let btnTxt = isFull ? (maxSlots > 0 ? "Parking plein" : "Requis") : "Acheter";

                fleetList.innerHTML += `
                    <div style="background:var(--card-bg); border-radius:6px; padding: 10px 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); display:flex; justify-content:space-between; align-items:center; opacity: 0.85;">
                        <div style="display:flex; flex-direction:column; gap:2px;">
                            <span style="font-size:1em; color:var(--text-color);">${item.icon} <b>${item.name}</b></span>
                            <span style="font-size:0.75em; color:#7f8c8d;">Places : ${currentUsed}/${maxSlots} | Potentiel : +${item.income.toFixed(2)}€</span>
                        </div>
                        <div style="display:flex; flex-direction:column; align-items:flex-end;">
                            <span style="font-size:0.85em; font-weight:bold; color:var(--text-color); margin-bottom:4px;">${item.price.toLocaleString('fr-FR')} €</span>
                            <button style="background:var(--primary-color); color:white; border:none; padding:4px 10px; border-radius:4px; font-weight:bold; font-size:0.8em;" ${!canBuy ? 'disabled style="background:#bdc3c7;"' : ''} onclick="window.tycoon.buyVehicle('${k}')">${btnTxt}</button>
                        </div>
                    </div>
                `;
            });
        }
    }
};
