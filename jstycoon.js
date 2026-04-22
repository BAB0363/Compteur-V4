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
            relais: { id: 'relais', name: 'Relais Scooter', price: 4000, slots: 2, icon: '🛵', maxLimit: 5, targetVeh: 'scooter' },
            hangar: { id: 'hangar', name: 'Hangar Urbain', price: 28000, slots: 3, icon: '🚐', maxLimit: 4, targetVeh: 'vul' },
            quai: { id: 'quai', name: 'Quai Régional', price: 35000, slots: 5, icon: '🚚', maxLimit: 3, targetVeh: 'porteur' },
            plateforme: { id: 'plateforme', name: 'Plateforme Logistique', price: 100000, slots: 10, icon: '🚛', maxLimit: 2, targetVeh: 'tracteur' },
            terminal: { id: 'terminal', name: 'Terminal Frigo', price: 250000, slots: 5, icon: '❄️', maxLimit: 2, targetVeh: 'frigo' },
            zone: { id: 'zone', name: 'Zone de Convoi', price: 500000, slots: 3, icon: '⚠️', maxLimit: 2, targetVeh: 'convoi' }
        },
        fleet: {
            scooter: { id: 'scooter', name: 'Scooter', price: 2500, income: 0.05, capacity: 0.05, icon: '🛵', buildingId: 'relais', tireLifeKm: 8000, fuelTank: 7, l100: 3, serviceInterval: 5000 },
            vul: { id: 'vul', name: 'Fourgon', price: 18000, income: 0.20, capacity: 0.8, icon: '🚐', buildingId: 'hangar', tireLifeKm: 45000, fuelTank: 80, l100: 8, serviceInterval: 15000 },
            porteur: { id: 'porteur', name: 'Porteur 19t', price: 55000, income: 0.60, capacity: 8, icon: '🚚', buildingId: 'quai', tireLifeKm: 150000, fuelTank: 300, l100: 22, serviceInterval: 30000 },
            tracteur: { id: 'tracteur', name: 'Tracteur', price: 130000, income: 1.50, capacity: 24, icon: '🚛', buildingId: 'plateforme', tireLifeKm: 200000, fuelTank: 1000, l100: 32, serviceInterval: 50000 },
            frigo: { id: 'frigo', name: 'Ensemble Frigo', price: 190000, income: 2.50, capacity: 24, icon: '❄️', buildingId: 'terminal', tireLifeKm: 180000, fuelTank: 1000, l100: 35, serviceInterval: 40000 },
            convoi: { id: 'convoi', name: 'Convoi Except.', price: 400000, income: 5.00, capacity: 60, icon: '⚠️', buildingId: 'zone', tireLifeKm: 12000, fuelTank: 1500, l100: 55, serviceInterval: 10000 }
        }
    },

    fuelPrice: 1.80,

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

    // 🧠 NOUVELLE LOGIQUE : LE SMART DISPATCH
    getFleetStatus() {
        let availableFleet = this.state.fleet.filter(v => v.health > 20 && v.fuel > 0);
        // On trie du plus GROS au plus PETIT
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
        let levelInfo = this.warehouseConfig.levels[this.state.warehouseLevel];
        return levelInfo ? levelInfo.cap : 0;
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
        const basePrice = 2.50;
        const cap = this.getWarehouseCapacity();
        if (cap === 0) return 0;
        const fillRate = this.state.storedFreight / cap;
        
        let price = basePrice;
        if (fillRate < 0.20) price = basePrice * 1.5;
        if (fillRate > 0.80) price = basePrice * 0.5;
        
        let volumeBonus = 1 + (fillRate * 0.15);
        price = price * volumeBonus;

        let modifier = this.state.carbonModifier || 1.0;
        return price * modifier;
    },

    upgradeWarehouse() {
        const nextLevel = this.state.warehouseLevel + 1;
        if (nextLevel >= this.warehouseConfig.levels.length) return;
        const cost = this.warehouseConfig.levels[nextLevel].price;
        if (window.app.bankBalance >= cost) {
            window.app.addBankTransaction(-cost, `Extension Entrepôt : ${this.warehouseConfig.levels[nextLevel].name}`);
            this.state.warehouseLevel = nextLevel;
            this.saveState();
            this.renderUI();
            if(window.ui) window.ui.showToast("🏗️ Entrepôt agrandi !");
        } else {
            if(window.ui) window.ui.showToast("❌ Fonds insuffisants !");
        }
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
            if (def) {
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
        let cost = needed * this.fuelPrice;
        
        if (window.app.bankBalance < cost) {
            if(window.ui) window.ui.showToast("❌ Pas assez d'argent pour l'essence !");
            return;
        }
        
        window.app.addBankTransaction(-cost, `Plein ${def.name}`);
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
        
        window.app.addBankTransaction(-cost, `Pneus Neufs ${def.name}`);
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
        
        window.app.addBankTransaction(-cost, `Révision ${def.name}`);
        v.health = 100;
        v.kmsSinceService = 0; 
        v.losses = (v.losses || 0) + cost;
        this.saveState();
        this.renderUI();
    },

    tickDistance(km) {
        if (!this.state.fleet || this.state.fleet.length === 0) return;
        
        if (window.app && !window.app.isCarRunning && !window.app.isTruckRunning) return;

        let needsSave = false;
        let cap = this.getWarehouseCapacity();
        let fillRate = cap > 0 ? (this.state.storedFreight / cap) : 0;
        let weightPenalty = 1 + fillRate; 

        this.state.fleet.forEach(veh => {
            let def = this.catalog.fleet[veh.type];
            if (!def) return;

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
                    if (def) {
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
                        
                        if (window.app) window.app.addBankTransaction(-cost, `🚨 Panne Imprévue (${def.name})`);
                        if(window.ui) window.ui.showToast(`🚨 Panne ${isMajor ? 'MAJEURE' : 'mineure'} sur ton ${def.name} ! Frais : -${cost.toFixed(0)}€`, "anomaly");
                        needsRender = true;
                    }
                }
            });
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
                window.app.addBankTransaction(earned, "🏢 Bénéfices Flotte (Session)");
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
        if(btnUp) {
            let next = this.warehouseConfig.levels[this.state.warehouseLevel + 1];
            btnUp.innerText = next ? `Améliorer vers ${next.name} (${next.price.toLocaleString('fr-FR')}€)` : "Niveau Maximum";
            btnUp.disabled = !next || window.app.bankBalance < next.price;
        }
        
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

        // 🎨 UI COMPACTE DES BÂTIMENTS
        let buildList = document.getElementById('company-buildings-list');
        if(buildList) {
            buildList.innerHTML = '';
            Object.keys(this.catalog.buildings).forEach(k => {
                let b = this.catalog.buildings[k];
                let count = this.state.buildings[k] || 0;
                let price = this.getBuildingPrice(k);
                let canBuy = window.app && window.app.bankBalance >= price && count < b.maxLimit;
                
                buildList.innerHTML += `
                    <div class="vehicle-card" style="opacity: ${count === b.maxLimit ? '0.6' : '1'}">
                        <div class="vehicle-name" style="display:flex; justify-content:space-between; align-items:center; padding: 2px 4px; border-bottom: 1px dashed var(--border-color); margin-bottom: 4px;">
                            <span>${b.icon} ${b.name} (${count}/${b.maxLimit})</span>
                            <span style="font-size:0.9em; font-weight:bold;">${price.toLocaleString('fr-FR')}€</span>
                        </div>
                        <div class="vehicle-controls">
                            <button class="btn-add btn-add-fr" ${!canBuy ? 'disabled' : ''} onclick="window.tycoon.buyBuilding('${k}')" style="width:100%; border-radius: 4px; font-size: 0.9em;">Investir</button>
                        </div>
                    </div>`;
            });
        }

        // 🎨 UI COMPACTE DE LA FLOTTE
        let fleetList = document.getElementById('company-fleet-list');
        if(fleetList) {
            fleetList.className = 'km-stats-grid'; 
            fleetList.style.display = 'grid';
            fleetList.innerHTML = '';
            
            this.state.fleet.forEach(v => {
                let d = this.catalog.fleet[v.type];
                let isDelivering = status.deliveringVehicles.some(dv => dv.uid === v.uid);
                let badge = isDelivering ? '📦' : '☕';
                let colorBorder = isDelivering ? '#27ae60' : '#3498db';
                
                let isCritical = v.fuel <= (d.fuelTank * 0.1) || v.health <= 30 || (v.tires || 100) <= 10;
                if (isCritical) colorBorder = '#e74c3c';

                let vehROI = (v.gains || 0) - (v.losses || 0);

                fleetList.innerHTML += `
                    <div class="vehicle-card" style="border-left: 5px solid ${colorBorder};">
                        <div class="vehicle-name" style="display:flex; justify-content:space-between; align-items:center; padding: 2px 4px; border-bottom: 1px dashed var(--border-color); margin-bottom: 4px;">
                            <span>${d.icon} ${d.name} ${badge}</span>
                            <span style="font-size:0.9em; font-weight:bold; color: ${vehROI >= 0 ? '#27ae60' : '#e74c3c'}">${vehROI.toFixed(0)}€</span>
                        </div>
                        
                        <div style="display:flex; gap: 5px; padding: 0 4px 4px 4px; font-size: 0.7em;">
                            <div style="flex:1; background:#bdc3c7; border-radius:2px; height:4px; overflow:hidden;" title="Carburant"><div style="width:${(v.fuel/d.fuelTank)*100}%; background:#f1c40f; height:100%;"></div></div>
                            <div style="flex:1; background:#bdc3c7; border-radius:2px; height:4px; overflow:hidden;" title="Santé Moteur"><div style="width:${v.health}%; background:#e74c3c; height:100%;"></div></div>
                            <div style="flex:1; background:#bdc3c7; border-radius:2px; height:4px; overflow:hidden;" title="État des Pneus"><div style="width:${v.tires||100}%; background:#34495e; height:100%;"></div></div>
                        </div>

                        <div class="vehicle-controls">
                            <button class="btn-corr" onclick="window.tycoon.refuel('${v.uid}')" title="Plein ⛽">⛽</button>
                            <button class="btn-corr" onclick="window.tycoon.repair('${v.uid}')" title="Réparer 🔧">🔧</button>
                            <button class="btn-corr" onclick="window.tycoon.changeTires('${v.uid}')" title="Pneus 🛞">🛞</button>
                            <button class="btn-corr" style="background:#e74c3c; color:white; border:none;" onclick="window.tycoon.sellVehicle('${v.uid}')" title="Vendre 🗑️">🗑️</button>
                        </div>
                    </div>`;
            });
            
            Object.keys(this.catalog.fleet).forEach(k => {
                let item = this.catalog.fleet[k];
                let bId = item.buildingId;
                let maxSlots = (this.state.buildings[bId] || 0) * this.catalog.buildings[bId].slots;
                let currentUsed = this.state.fleet.filter(v => v.type === k).length;
                
                if (currentUsed < maxSlots) {
                    let canBuy = window.app && window.app.bankBalance >= item.price;
                    fleetList.innerHTML += `
                        <div class="vehicle-card" style="opacity:0.7">
                            <div class="vehicle-name" style="display:flex; justify-content:space-between; align-items:center; padding: 2px 4px; border-bottom: 1px dashed var(--border-color); margin-bottom: 4px;">
                                <span>${item.icon} Acheter ${item.name}</span>
                                <span style="font-size:0.9em; font-weight:bold;">${item.price.toLocaleString('fr-FR')}€</span>
                            </div>
                            <div class="vehicle-controls">
                                <button class="btn-add btn-add-fr" ${!canBuy ? 'disabled' : ''} onclick="window.tycoon.buyVehicle('${k}')" style="width:100%; border-radius: 4px; font-size: 0.9em;">Commander</button>
                            </div>
                        </div>`;
                }
            });
        }
    }
};
