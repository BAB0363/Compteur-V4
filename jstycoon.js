// jstycoon.js - Gestion avancée de l'Empire (Flotte, Usure, Carburant)
export const tycoon = {
    state: {
        buildings: { parking: 0, terrain: 0, depot: 0, hub: 0 },
        fleet: [], // Désormais un tableau d'objets uniques !
        pendingIncome: 0,
        purchaseHistory: []
    },

    catalog: {
        buildings: {
            parking: { id: 'parking', name: 'Place de trottoir', price: 4000, slots: 1, icon: '🅿️' },
            terrain: { id: 'terrain', name: 'Terrain vague', price: 15000, slots: 3, icon: '🚧' },
            depot: { id: 'depot', name: 'Dépôt Sécurisé', price: 120000, slots: 10, icon: '🏭' },
            hub: { id: 'hub', name: 'Hub Logistique', price: 800000, slots: 999, icon: '🏢' }
        },
        fleet: {
            scooter: { id: 'scooter', name: 'Scooter rincé', price: 4000, income: 0.12, icon: '🛵' },
            vul: { id: 'vul', name: 'VUL d\'occasion', price: 15000, income: 0.50, icon: '🚐' },
            porteur: { id: 'porteur', name: 'Petit Porteur 19t', price: 45000, income: 1.50, icon: '🚚' },
            tracteur: { id: 'tracteur', name: 'Tracteur Routier', price: 110000, income: 4.00, icon: '🚛' },
            frigo: { id: 'frigo', name: 'Ens. Frigorifique', price: 170000, income: 6.00, icon: '❄️' },
            convoi: { id: 'convoi', name: 'Convoi Exceptionnel', price: 350000, income: 12.00, icon: '⚠️' }
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
    },

    saveState() {
        let user = window.app && window.app.currentUser ? window.app.currentUser : 'Sylvain';
        localStorage.setItem(`tycoon_state_${user}`, JSON.stringify(this.state));
    },

    getStats() {
        let maxSlots = 0;
        Object.keys(this.state.buildings).forEach(k => {
            if (this.catalog.buildings[k]) {
                maxSlots += this.state.buildings[k] * this.catalog.buildings[k].slots;
            }
        });
        
        let usedSlots = this.state.fleet.length;
        let incomePerMin = 0;

        this.state.fleet.forEach(veh => {
            let def = this.catalog.fleet[veh.type];
            // Le véhicule ne rapporte que s'il a de l'essence et n'est pas en panne !
            if (def && veh.fuel > 0 && veh.health > 0) {
                incomePerMin += def.income;
            }
        });

        if (this.state.buildings.hub > 0) incomePerMin *= 1.10;
        if (usedSlots > 0) incomePerMin *= (1 + usedSlots * 0.05); // Bonus Tycoon

        return { maxSlots, usedSlots, incomePerMin };
    },

    buyBuilding(id) {
        let item = this.catalog.buildings[id];
        if (window.app.bankBalance < item.price) {
            if(window.ui) window.ui.showToast("❌ Fonds insuffisants !");
            return;
        }
        if(confirm(`Investir ${item.price.toLocaleString('fr-FR')} € dans : ${item.name} ?`)) {
            window.app.addBankTransaction(-item.price, `Achat Immo : ${item.name}`);
            this.state.buildings[id] = (this.state.buildings[id] || 0) + 1;
            this.state.purchaseHistory.push({ type: 'building', id: id, time: Date.now(), price: item.price });
            this.saveState();
            this.renderUI();
            if(window.ui) { window.ui.playGamiSound('cash'); window.ui.showToast(`🏢 Achat réussi !`); }
        }
    },

    buyVehicle(id) {
        let item = this.catalog.fleet[id];
        let stats = this.getStats();
        
        if (window.app.bankBalance < item.price) {
            if(window.ui) window.ui.showToast("❌ Fonds insuffisants !");
            return;
        }
        if (stats.usedSlots >= stats.maxSlots) {
            if(window.ui) window.ui.showToast("🅿️ Plus de place de parking !");
            return;
        }

        if(confirm(`Acheter ${item.name} pour ${item.price.toLocaleString('fr-FR')} € ?`)) {
            window.app.addBankTransaction(-item.price, `Achat Flotte : ${item.name}`);
            
            // Création d'un véhicule unique
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
            if(window.ui) { window.ui.playGamiSound('cash'); window.ui.showToast(`🚚 Nouveau véhicule ajouté !`); }
        }
    },

    sellVehicle(uid) {
        let index = this.state.fleet.findIndex(v => v.uid === uid);
        if (index === -1) return;
        
        let veh = this.state.fleet[index];
        let item = this.catalog.fleet[veh.type];
        
        // Formule de décote : On perd 40% direct à l'achat, puis c'est proportionnel à la santé
        let sellPrice = (item.price * 0.60) * (veh.health / 100);
        
        if(confirm(`Revendre ce ${item.name} pour ${sellPrice.toLocaleString('fr-FR', {maximumFractionDigits:2})} € ?\n(Décote appliquée selon l'état)`)) {
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
        let cost = (item.price * 0.02) * (missingPct / 100); // Le plein coûte 2% du prix neuf
        
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
        let cost = (item.price * 0.08) * (missingPct / 100); // Une réparation complète coûte 8% du prix neuf
        
        if (window.app.bankBalance < cost) {
            if(window.ui) window.ui.showToast("❌ Pas assez d'argent pour les pièces !");
            return;
        }
        
        window.app.addBankTransaction(-cost, `Garage (Réparations) : ${item.name}`);
        veh.health = 100;
        this.saveState();
        this.renderUI();
    },

    tickSecond(secondsElapsed) {
        let stats = this.getStats();
        // Ajout des revenus chaque seconde (lissé)
        if (stats.incomePerMin > 0) {
            this.state.pendingIncome += (stats.incomePerMin / 60);
            let displayPending = document.getElementById('company-pending-income');
            if (displayPending) displayPending.innerText = this.state.pendingIncome.toFixed(2) + ' €';
        }

        // Usure toutes les 60 secondes (1 minute)
        if (secondsElapsed > 0 && secondsElapsed % 60 === 0) {
            let needsRender = false;
            this.state.fleet.forEach(veh => {
                // S'il reste du carburant, on en consomme (2% par minute)
                if (veh.fuel > 0) {
                    veh.fuel = Math.max(0, veh.fuel - 2);
                    needsRender = true;
                }
                // Si on roule, on s'use (1% par minute)
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
        
        let elSlotsUsed = document.getElementById('company-slots-used');
        let elSlotsMax = document.getElementById('company-slots-max');
        let elRate = document.getElementById('company-rate-display');
        let elPending = document.getElementById('company-pending-income');

        if(elSlotsUsed) elSlotsUsed.innerText = stats.usedSlots;
        if(elSlotsMax) elSlotsMax.innerText = stats.maxSlots === 0 ? "0" : (stats.maxSlots >= 999 ? "∞" : stats.maxSlots);
        if(elRate) elRate.innerText = `Rythme actuel : + ${stats.incomePerMin.toFixed(2)} € / min`;
        if(elPending) elPending.innerText = this.state.pendingIncome.toFixed(2) + ' €';

        let buildList = document.getElementById('company-buildings-list');
        if(buildList) {
            buildList.innerHTML = '';
            Object.keys(this.catalog.buildings).forEach(k => {
                let item = this.catalog.buildings[k];
                let count = this.state.buildings[k] || 0;
                let canBuy = window.app.bankBalance >= item.price;
                
                buildList.innerHTML += `
                    <div class="tycoon-card ${count > 0 ? 'owned' : ''}">
                        ${count > 0 ? `<div class="tycoon-owned-badge">${count}x</div>` : ''}
                        <div class="tycoon-title">${item.icon} ${item.name}</div>
                        <div class="tycoon-revenue">Places : +${item.slots >= 999 ? 'Illimitées' : item.slots}</div>
                        <div class="tycoon-price">${item.price.toLocaleString('fr-FR')} €</div>
                        <button class="btn-buy" ${!canBuy ? 'disabled' : ''} onclick="window.tycoon.buyBuilding('${k}')">Acheter</button>
                    </div>
                `;
            });
        }

        let fleetList = document.getElementById('company-fleet-list');
        if(fleetList) {
            fleetList.innerHTML = '';
            
            // 1. D'abord, on affiche les véhicules possédés (Notre Garage dynamique !)
            this.state.fleet.forEach(veh => {
                let item = this.catalog.fleet[veh.type];
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

            // 2. Ensuite, on affiche le catalogue pour acheter de nouveaux camions
            Object.keys(this.catalog.fleet).forEach(k => {
                let item = this.catalog.fleet[k];
                let canBuy = window.app.bankBalance >= item.price && stats.usedSlots < stats.maxSlots;
                let btnTxt = stats.usedSlots >= stats.maxSlots && stats.maxSlots > 0 ? "Parking plein" : "Acheter neuf";

                fleetList.innerHTML += `
                    <div class="tycoon-card" style="opacity: 0.85;">
                        <div class="tycoon-title">${item.icon} ${item.name}</div>
                        <div class="tycoon-revenue">Potentiel : +${item.income.toFixed(2)} €/min</div>
                        <div class="tycoon-price">${item.price.toLocaleString('fr-FR')} €</div>
                        <button class="btn-buy" ${!canBuy ? 'disabled' : ''} onclick="window.tycoon.buyVehicle('${k}')">${btnTxt}</button>
                    </div>
                `;
            });
        }
    }
};
