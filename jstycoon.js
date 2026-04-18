// jstycoon.js - Gestion avancée de l'Empire (Flotte, Usure, Carburant, Logistique)
export const tycoon = {
    state: {
        warehouseLevel: 0,
        storedFreight: 0,
        companyCarbon: 0,
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
            hangar: { id: 'hangar', name: 'Hangar Urbain', price: 12000, slots: 3, icon: '🚐', maxLimit: 4, targetVeh: 'vul' },
            quai: { id: 'quai', name: 'Quai Régional', price: 35000, slots: 5, icon: '🚚', maxLimit: 3, targetVeh: 'porteur' },
            plateforme: { id: 'plateforme', name: 'Plateforme Logistique', price: 100000, slots: 10, icon: '🚛', maxLimit: 2, targetVeh: 'tracteur' },
            terminal: { id: 'terminal', name: 'Terminal Frigo', price: 250000, slots: 5, icon: '❄️', maxLimit: 2, targetVeh: 'frigo' },
            zone: { id: 'zone', name: 'Zone de Convoi', price: 500000, slots: 3, icon: '⚠️', maxLimit: 2, targetVeh: 'convoi' }
        },
        fleet: {
            scooter: { id: 'scooter', name: 'Scooter de livraison', price: 2500, income: 0.15, icon: '🛵', buildingId: 'relais' },
            vul: { id: 'vul', name: 'Fourgon utilitaire', price: 18000, income: 0.60, icon: '🚐', buildingId: 'hangar' },
            porteur: { id: 'porteur', name: 'Porteur 19 tonnes', price: 55000, income: 1.80, icon: '🚚', buildingId: 'quai' },
            tracteur: { id: 'tracteur', name: 'Tracteur Routier', price: 130000, income: 4.50, icon: '🚛', buildingId: 'plateforme' },
            frigo: { id: 'frigo', name: 'Ensemble Frigorifique', price: 190000, income: 7.00, icon: '❄️', buildingId: 'terminal' },
            convoi: { id: 'convoi', name: 'Convoi Exceptionnel', price: 400000, income: 15.00, icon: '⚠️', buildingId: 'zone' }
        }
    },

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
    this.checkWeeklyCarbon();
},

    saveState() {
        let user = window.app && window.app.currentUser ? window.app.currentUser : 'Sylvain';
        localStorage.setItem(`tycoon_state_${user}`, JSON.stringify(this.state));
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
            let limit = 50000; // Tolérance de 50 kg de CO2 par semaine
            if (this.state.companyCarbon > limit) {
                this.state.carbonModifier = 0.7; // Malus de 30% sur les ventes
                if(window.ui) window.ui.showToast("🚨 Bilan Hebdo : Malus Carbone (-30% sur les ventes) !");
            } else if (this.state.companyCarbon < 0) {
                this.state.carbonModifier = 1.2; // Bonus de 20% sur les ventes
                if(window.ui) window.ui.showToast("🌿 Bilan Hebdo : Bonus Écolo (+20% sur les ventes) !");
            } else {
                this.state.carbonModifier = 1.0;
                if(window.ui) window.ui.showToast("⚖️ Bilan Hebdo : Neutre.");
            }
            this.state.companyCarbon = 0; // Remise à zéro pour la nouvelle semaine
            this.state.lastResetWeek = currentWeek;
            this.saveState();
        }
    },

    addCarbon(grams) {
        this.state.companyCarbon += grams;
        this.saveState();
    },

    getDynamicPrice() {

        const basePrice = 0.05;
        const cap = this.getWarehouseCapacity();
        if (cap === 0) return 0;
        const fillRate = this.state.storedFreight / cap;
              if (fillRate < 0.20) return basePrice * 1.5;
        if (fillRate > 0.80) return basePrice * 0.5;
        
        let modifier = this.state.carbonModifier || 1.0; // <--- AJOUTE
        return basePrice * modifier;                     // <--- MODIFIE LE RETURN
    },


    getDeliveryPower() {
        let totalTonsPerKm = 0;
        this.state.fleet.forEach(veh => {
            const caps = { 'scooter': 0.05, 'vul': 0.8, 'porteur': 8, 'tracteur': 24, 'frigo': 24, 'convoi': 60 };
            if (veh.health > 20 && veh.fuel > 0) {
                totalTonsPerKm += caps[veh.type] || 0;
            }
        });
        return totalTonsPerKm;
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

        this.state.fleet.forEach(veh => {
            let def = this.catalog.fleet[veh.type];
            if (def && veh.fuel > 0 && veh.health > 0) {
                incomePerMin += def.income;
            }
        });

        if ((this.state.buildings.zone || 0) > 0) incomePerMin *= 1.10;
        if (usedSlots > 0) incomePerMin *= (1 + usedSlots * 0.05);

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
        let item = this.catalog.fleet[id];
        let buildingId = item.buildingId;
        
        let buildingCount = this.state.buildings[buildingId] || 0;
        let maxSlotsForType = buildingCount * this.catalog.buildings[buildingId].slots;
        let usedSlotsForType = this.state.fleet.filter(v => v.type === id).length;
        
        if (window.app.bankBalance < item.price) {
            if(window.ui) window.ui.showToast("❌ Fonds insuffisants !");
            return;
        }

        if (usedSlotsForType >= maxSlotsForType) {
            let bName = this.catalog.buildings[buildingId].name;
            if(window.ui) window.ui.showToast(`🅿️ Pas de place ! Achète plus de "${bName}".`);
            return;
        }

        if(confirm(`Acheter ${item.name} pour ${item.price.toLocaleString('fr-FR')} € ?`)) {
            window.app.addBankTransaction(-item.price, `Achat Flotte : ${item.name}`);
            let newVeh = {
                uid: 'veh_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                type: id,
                health: 100,
                fuel: 100
            };
            this.state.fleet.push(newVeh);
            this.state.purchaseHistory.push({ type: 'fleet', id: id, time: Date.now(), price: item.price });
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
        let veh = this.state.fleet.find(v => v.uid === uid);
        if (!veh || veh.fuel >= 100) return;
        
        let item = this.catalog.fleet[veh.type];
        let missingPct = 100 - veh.fuel;
        let cost = (item.price * 0.02) * (missingPct / 100);
        
        if (window.app.bankBalance < cost) {
            if(window.ui) window.ui.showToast("❌ Pas assez d'argent pour l'essence !");
            return;
        }
        
        window.app.addBankTransaction(-cost, `Carburant : ${item.name}`);
        veh.fuel = 100;
        this.saveState();
        this.renderUI();
    },

    repair(uid) {
        let veh = this.state.fleet.find(v => v.uid === uid);
        if (!veh || veh.health >= 100) return;
        
        let item = this.catalog.fleet[veh.type];
        let missingPct = 100 - veh.health;
        let cost = (item.price * 0.08) * (missingPct / 100);
        
        if (window.app.bankBalance < cost) {
            if(window.ui) window.ui.showToast("❌ Pas assez d'argent pour les pièces !");
            return;
        }
        
        window.app.addBankTransaction(-cost, `Garage : ${item.name}`);
        veh.health = 100;
        this.saveState();
        this.renderUI();
    },

    tickSecond(secondsElapsed) {
        let stats = this.getStats();
        if (stats.incomePerMin > 0) {
            this.state.pendingIncome += (stats.incomePerMin / 60);
            let displayPending = document.getElementById('company-pending-income');
            if (displayPending) displayPending.innerText = this.state.pendingIncome.toFixed(2) + ' €';
        }

        if (secondsElapsed > 0 && secondsElapsed % 60 === 0) {
            let needsRender = false;
            this.state.fleet.forEach(veh => {
                if (veh.fuel > 0) {
                    veh.fuel = Math.max(0, veh.fuel - 2);
                    needsRender = true;
                }
                if (veh.fuel > 0 && veh.health > 0) {
                    veh.health = Math.max(0, veh.health - 1);
                    needsRender = true;
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
        
        let cap = this.getWarehouseCapacity();
        let levelInfo = this.warehouseConfig.levels[this.state.warehouseLevel];
        let fillPct = cap > 0 ? (this.state.storedFreight / cap) * 100 : 0;

        if(document.getElementById('warehouse-name')) document.getElementById('warehouse-name').innerText = levelInfo ? levelInfo.name : "Aucun";
        if(document.getElementById('warehouse-tons')) document.getElementById('warehouse-tons').innerText = this.state.storedFreight.toFixed(1) + " t";
        if(document.getElementById('warehouse-cap')) document.getElementById('warehouse-cap').innerText = "Capacité max : " + cap + " t";
             if(document.getElementById('warehouse-bar')) document.getElementById('warehouse-bar').style.width = Math.min(100, fillPct) + "%";

        // --- NOUVEAU : MISE À JOUR VISUELLE DU CARBONE ENTREPRISE ---
        let carbTotal = this.state.companyCarbon || 0;
        let carbLimit = 50000; // Seuil de 50kg (en grammes)
        let carbFill = Math.min(100, Math.max(0, (carbTotal / carbLimit) * 100));
        
        if(document.getElementById('company-carb-total')) {
            document.getElementById('company-carb-total').innerText = (carbTotal / 1000).toFixed(1) + " kg CO2";
        }
        if(document.getElementById('company-carb-bar')) {
            let bar = document.getElementById('company-carb-bar');
            bar.style.width = carbFill + "%";
            // La barre change de couleur selon la pollution
            bar.style.backgroundColor = carbFill > 80 ? "#e74c3c" : (carbFill > 50 ? "#f39c12" : "#27ae60");
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
        // ------------------------------------------------------------

        let btnUp = document.getElementById('btn-upgrade-warehouse');

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
        if(elRate) elRate.innerText = `Rythme actuel : + ${stats.incomePerMin.toFixed(2)} € / min`;
        if(elPending) elPending.innerText = this.state.pendingIncome.toFixed(2) + ' €';

        let buildList = document.getElementById('company-buildings-list');
        if(buildList) {
            buildList.innerHTML = '';
            Object.keys(this.catalog.buildings).forEach(k => {
                let item = this.catalog.buildings[k];
                let count = this.state.buildings[k] || 0;
                let currentPrice = this.getBuildingPrice(k);
                let isMaxed = count >= item.maxLimit;
                
                let canBuy = window.app.bankBalance >= currentPrice && !isMaxed;
                let btnTxt = isMaxed ? "Max Atteint" : "Acheter";
                
                buildList.innerHTML += `
                    <div class="tycoon-card ${count > 0 ? 'owned' : ''}" style="${isMaxed ? 'opacity: 0.8;' : ''}">
                        ${count > 0 ? `<div class="tycoon-owned-badge">${count} / ${item.maxLimit}</div>` : ''}
                        <div class="tycoon-title">${item.icon} ${item.name}</div>
                        <div class="tycoon-revenue">Places : +${item.slots}</div>
                        <div class="tycoon-price" style="${isMaxed ? 'text-decoration: line-through; color: #7f8c8d;' : ''}">
                            ${currentPrice.toLocaleString('fr-FR')} €
                        </div>
                        <button class="btn-buy" ${!canBuy ? 'disabled' : ''} onclick="window.tycoon.buyBuilding('${k}')">${btnTxt}</button>
                    </div>
                `;
            });
        }

        let fleetList = document.getElementById('company-fleet-list');
        if(fleetList) {
            fleetList.innerHTML = '';
            
            this.state.fleet.forEach(veh => {
                let item = this.catalog.fleet[veh.type];
                if (!item) return;
                let isBroken = veh.health <= 0 || veh.fuel <= 0;
                let sellPrice = (item.price * 0.60) * (veh.health / 100);
                let refuelCost = (item.price * 0.02) * ((100 - veh.fuel) / 100);
                let repairCost = (item.price * 0.08) * ((100 - veh.health) / 100);

                fleetList.innerHTML += `
                    <div class="tycoon-card owned" style="${isBroken ? 'border-color:var(--danger-color); background:rgba(220,53,69,0.05);' : ''}">
                        <div class="tycoon-owned-badge" style="${isBroken ? 'background:var(--danger-color);' : ''}">${isBroken ? '🛑 PANNE' : '✅ ACTIF'}</div>
                        <div class="tycoon-title">${item.icon} ${item.name}</div>
                        <div class="tycoon-revenue" style="${isBroken ? 'color:var(--danger-color);' : ''}">Revenu : ${isBroken ? '0.00' : '+'+item.income.toFixed(2)} €/min</div>
                        
                        <div style="margin: 8px 0;">
                            <div style="display:flex; justify-content:space-between; font-size:0.8em; margin-bottom:2px;">
                                <span>⛽ Ess. (${Math.round(veh.fuel)}%)</span>
                                <span>${veh.fuel >= 100 ? 'Plein' : refuelCost.toFixed(2)+' €'}</span>
                            </div>
                            <div style="background:var(--border-color); height:6px; border-radius:3px; overflow:hidden;">
                                <div style="width:${veh.fuel}%; height:100%; background:${veh.fuel > 20 ? 'var(--success-color)' : 'var(--danger-color)'};"></div>
                            </div>
                            
                            <div style="display:flex; justify-content:space-between; font-size:0.8em; margin-bottom:2px; margin-top:6px;">
                                <span>🔧 État (${Math.round(veh.health)}%)</span>
                                <span>${veh.health >= 100 ? 'Neuf' : repairCost.toFixed(2)+' €'}</span>
                            </div>
                            <div style="background:var(--border-color); height:6px; border-radius:3px; overflow:hidden;">
                                <div style="width:${veh.health}%; height:100%; background:${veh.health > 30 ? 'var(--primary-color)' : 'var(--danger-color)'};"></div>
                            </div>
                        </div>

                        <div style="display:flex; gap:5px;">
                            <button style="flex:1; background:var(--success-color); color:white; border:none; border-radius:5px; padding:6px; font-weight:bold; cursor:pointer;" onclick="window.tycoon.refuel('${veh.uid}')" ${veh.fuel >= 100 || window.app.bankBalance < refuelCost ? 'disabled' : ''}>Plein</button>
                            <button style="flex:1; background:var(--primary-color); color:white; border:none; border-radius:5px; padding:6px; font-weight:bold; cursor:pointer;" onclick="window.tycoon.repair('${veh.uid}')" ${veh.health >= 100 || window.app.bankBalance < repairCost ? 'disabled' : ''}>Réparer</button>
                        </div>
                        <button style="margin-top:5px; background:var(--danger-color); color:white; border:none; border-radius:5px; padding:8px; font-weight:bold; cursor:pointer; width:100%;" onclick="window.tycoon.sellVehicle('${veh.uid}')">Revendre (${sellPrice.toLocaleString('fr-FR', {maximumFractionDigits:0})} €)</button>
                    </div>
                `;
            });

            Object.keys(this.catalog.fleet).forEach(k => {
                let item = this.catalog.fleet[k];
                let buildingId = item.buildingId;
                let maxSlots = (this.state.buildings[buildingId] || 0) * this.catalog.buildings[buildingId].slots;
                let currentUsed = this.state.fleet.filter(v => v.type === k).length;
                
                let isFull = currentUsed >= maxSlots;
                let canBuy = window.app.bankBalance >= item.price && !isFull;
                let btnTxt = isFull ? (maxSlots > 0 ? "Parking plein" : "Bâtiment requis") : "Acheter neuf";

                fleetList.innerHTML += `
                    <div class="tycoon-card" style="opacity: 0.85;">
                        <div class="tycoon-title">${item.icon} ${item.name}</div>
                        <div class="tycoon-revenue">Potentiel : +${item.income.toFixed(2)} €/min</div>
                        <div class="tycoon-revenue" style="color:var(--primary-color); font-weight:bold; font-size:0.85em;">Places : ${currentUsed} / ${maxSlots}</div>
                        <div class="tycoon-price">${item.price.toLocaleString('fr-FR')} €</div>
                        <button class="btn-buy" ${!canBuy ? 'disabled' : ''} onclick="window.tycoon.buyVehicle('${k}')">${btnTxt}</button>
                    </div>
                `;
            });
        }
    }
};
