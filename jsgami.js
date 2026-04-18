// jsgami.js - Gestionnaire de Missions (Gamification Financière)
export const gami = {
    state: {
        seasonId: "", 
        seasonName: "",
        dailyQuests: [],
        weeklyQuests: [],
        seasonQuests: [],
        lastDailyUpdate: 0,
        lastWeeklyUpdate: 0
    },

    seasonNames: {
        1: "❄️ Saison 1 : L'Hiver des Poids Lourds",
        2: "🌸 Saison 2 : Le Réveil de l'Asphalte",
        3: "☀️ Saison 3 : Le Chassé-Croisé Estival",
        4: "🍂 Saison 4 : Les Rois de l'Automne"
    },

    getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    },

    init() {
        this.loadState();
        
        if (!Array.isArray(this.state.dailyQuests)) this.state.dailyQuests = [];
        if (!Array.isArray(this.state.weeklyQuests)) this.state.weeklyQuests = [];
        if (!Array.isArray(this.state.seasonQuests)) this.state.seasonQuests = [];

        this.checkSeasonAndQuests();
        this.updateUI();
    },

    loadState() {
        let user = window.app && window.app.currentUser ? window.app.currentUser : "Default";
        let saved = localStorage.getItem(`gami_state_${user}`);
        if (saved) {
            try {
                let parsed = JSON.parse(saved);
                this.state = { ...this.state, ...parsed };
            } catch(e) { console.error("Sauvegarde corrompue, remise à zéro des missions."); }
        }
    },

    async saveState() {
        if (window.app && typeof window.app.saveUserData === 'function') {
            await window.app.saveUserData();
        } else {
            let user = window.app && window.app.currentUser ? window.app.currentUser : "Default";
            localStorage.setItem(`gami_state_${user}`, JSON.stringify(this.state));
        }
        try { this.updateUI(); } catch(e) {} 
    },

    getMonday(d) {
        d = new Date(d);
        var day = d.getDay(), diff = d.getDate() - day + (day == 0 ? -6 : 1);
        return new Date(d.setDate(diff)).setHours(0,0,0,0);
    },

    getSeasonDatesString() {
        let now = new Date();
        let year = now.getFullYear();
        let quarter = Math.floor(now.getMonth() / 3) + 1;
        
        let startMonth = (quarter - 1) * 3;
        let endMonth = startMonth + 2;
        
        let startDate = new Date(year, startMonth, 1);
        let endDate = new Date(year, endMonth + 1, 0); 
        
        const format = (d) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        return `(du ${format(startDate)} au ${format(endDate)})`;
    },

    checkSeasonAndQuests() {
        let now = new Date();
        let year = now.getFullYear();
        let month = now.getMonth(); 
        let quarter = Math.floor(month / 3) + 1; 
        let currentSeasonId = `${year}-Q${quarter}`;

        if (this.state.seasonId !== currentSeasonId) {
            this.state.seasonId = currentSeasonId;
            this.state.seasonName = this.seasonNames[quarter];
            this.state.dailyQuests = [];
            this.state.weeklyQuests = [];
            this.state.seasonQuests = this.generateSeasonQuests();
            if(window.ui) window.ui.showToast(`🌷 Début de la ${this.state.seasonName} !`);
        }

        if (!this.state.seasonName) this.state.seasonName = this.seasonNames[quarter];

        let today = new Date(year, month, now.getDate()).getTime();
        if (!this.state.lastDailyUpdate || this.state.lastDailyUpdate < today || this.state.dailyQuests.length === 0) {
            this.state.dailyQuests = this.generateDailyQuests();
            this.state.lastDailyUpdate = today;
        }

        let thisMonday = this.getMonday(now);
        if (!this.state.lastWeeklyUpdate || this.state.lastWeeklyUpdate < thisMonday || this.state.weeklyQuests.length === 0) {
            this.state.weeklyQuests = this.generateWeeklyQuests();
            this.state.lastWeeklyUpdate = thisMonday;
        }

        if (!this.state.seasonQuests || this.state.seasonQuests.length === 0) {
            this.state.seasonQuests = this.generateSeasonQuests();
        }

        this.saveState();
    },

    generateDailyQuests() {
        const types = [
            { id: "d_tot", title: "Le Marathonien", desc: "Compter des véhicules.", min: 150, max: 300, type: "total", moneyReward: 50 },
            { id: "d_fr", title: "Flot National", desc: "Trouver des camions français.", min: 60, max: 120, type: "camion_fr", moneyReward: 75 },
            { id: "d_etr", title: "Transit Europe", desc: "Trouver des camions étrangers.", min: 60, max: 120, type: "camion_etr", moneyReward: 75 },
            { id: "d_uti", title: "Logistique Urbaine", desc: "Compter des Utilitaires.", min: 80, max: 150, type: "utilitaire", moneyReward: 60 },
            { id: "d_ia", title: "L'Œil d'Acier", desc: "Valider des prédictions IA exactes.", min: 15, max: 25, type: "ia_exact", moneyReward: 100 },
            { id: "d_flux", title: "Flux Tendu", desc: "Atteindre une chaîne de régularité.", target: 30, type: "regularite", moneyReward: 150 }
        ];
        
        return types.sort(() => 0.5 - Math.random()).slice(0, 3).map(q => {
            let finalTarget = q.target ? q.target : this.getRandomInt(q.min, q.max);
            return { 
                id: q.id, title: q.title, desc: q.desc.replace('.', ` (${finalTarget}).`), target: finalTarget, type: q.type, moneyReward: q.moneyReward, progress: 0, done: false 
            };
        });
    },

    generateWeeklyQuests() {
        const types = [
            { id: "w_tot", title: "Avenue du Monde", desc: "Compter des véhicules.", min: 3000, max: 5000, type: "total", moneyReward: 500 },
            { id: "w_dist", title: "Tour de France", desc: "Parcourir des kilomètres.", min: 500, max: 800, type: "distance", moneyReward: 750 },
            { id: "w_ia_cash", title: "Jackpot IA", desc: "Gagner de l'argent via les bonus IA (€).", min: 1000, max: 2500, type: "ia_cash", moneyReward: 800 },
            { id: "w_sponsor", title: "Flotte Majeure", desc: "Valider des contrats Sponsors.", min: 25, max: 40, type: "sponsor", moneyReward: 1000 },
            { id: "w_poids", title: "Colosse aux pieds d'argile", desc: "Déplacer du tonnage (en tonnes).", min: 10000, max: 15000, type: "tonnage", moneyReward: 600 },
            { id: "w_velo", title: "Peloton Vert", desc: "Identifier des Vélos.", min: 250, max: 400, type: "velo", moneyReward: 400 }
        ];
        
        return types.sort(() => 0.5 - Math.random()).slice(0, 2).map(q => {
            let finalTarget = this.getRandomInt(q.min, q.max);
            return { 
                id: q.id, title: q.title, desc: q.desc.replace('.', ` (${finalTarget}).`), target: finalTarget, type: q.type, moneyReward: q.moneyReward, progress: 0, done: false 
            };
        });
    },

    generateSeasonQuests() {
        const types = [
            { id: "s_tot", title: "Le Maître du Monde", desc: "Atteindre un total de véhicules.", min: 50000, max: 100000, type: "total", moneyReward: 5000 },
            { id: "s_tycoon", title: "L'Empire du Trafic", desc: "Acheter des actifs (Flotte/Bâtiments).", min: 50, max: 100, type: "tycoon_buy", moneyReward: 7500 },
            { id: "s_alt", title: "Aigle des Sommets", desc: "Compter des véhicules à >500m d'altitude.", target: 5000, type: "altitude", moneyReward: 4000 },
            { id: "s_ia", title: "L'Oracle Suprême", desc: "Réussir des prédictions IA exactes.", target: 10000, type: "ia_exact", moneyReward: 10000 },
            { id: "s_eco", title: "Écolo-Millionnaire", desc: "Encaisser de la revente carbone (€).", target: 5000, type: "carbone_cash", moneyReward: 5000 },
            { id: "s_nuit", title: "Vampire de l'Asphalte", desc: "Compter des véhicules de nuit (21h-6h).", target: 10000, type: "nuit", moneyReward: 6000 }
        ];

        return types.sort(() => 0.5 - Math.random()).slice(0, 2).map(q => {
            let finalTarget = q.target ? q.target : this.getRandomInt(q.min, q.max);
            return { 
                id: q.id, title: q.title, desc: q.desc.replace('.', ` (${finalTarget}).`), target: finalTarget, type: q.type, moneyReward: q.moneyReward, progress: 0, done: false 
            };
        });
    },

    updateProgress(type, amount = 1, isAbsolute = false) {
        let changed = false;

        const checkAndUpdate = (q) => {
            if (!q || q.done) return false;
            if (q.type === type) {
                if (isAbsolute) {
                    if (amount > q.progress) q.progress = Math.round(amount);
                } else {
                    q.progress += amount;
                    q.progress = parseFloat(q.progress.toFixed(2));
                }

                if (q.progress >= q.target) {
                    q.progress = q.target;
                    q.done = true;
                    
                    // 💰 Récompense en cash directement !
                    if (window.app) window.app.addBankTransaction(q.moneyReward, `🎯 Récompense Mission : ${q.title}`);
                    this.showToast(`🎯 Mission accomplie : ${q.title} (+${q.moneyReward} €)`);
                    if (window.ui) window.ui.playGamiSound('questDone');
                }
                return true;
            }
            return false;
        };

        if (this.state.dailyQuests) this.state.dailyQuests.forEach(q => { if(checkAndUpdate(q)) changed = true; });
        if (this.state.weeklyQuests) this.state.weeklyQuests.forEach(q => { if(checkAndUpdate(q)) changed = true; });
        if (this.state.seasonQuests) this.state.seasonQuests.forEach(q => { if(checkAndUpdate(q)) changed = true; });

        if (changed) this.saveState();
    },

    notifyVehicleAdded(typeVehicule, nationalite = null, extraData = {}) {
        this.updateProgress("total", 1);
        
        if (typeVehicule === "Camions") {
            this.updateProgress("poids_lourds", 1);
            if (nationalite === "fr") this.updateProgress("camion_fr", 1);
            if (nationalite === "etr") this.updateProgress("camion_etr", 1);
        }
        if (typeVehicule === "Utilitaires") this.updateProgress("utilitaire", 1);
        if (typeVehicule === "Vélos") this.updateProgress("velo", 1);

        if (extraData.weight) this.updateProgress("tonnage", extraData.weight / 1000); 
        if (extraData.isNight) this.updateProgress("nuit", 1);
        if (extraData.alt && extraData.alt > 500) this.updateProgress("altitude", 1);
        
        if (extraData.isExact) {
            this.updateProgress("ia_exact", 1);
            if (extraData.iaCash > 0) this.updateProgress("ia_cash", extraData.iaCash);
        }

        if (extraData.regularity) {
            this.updateProgress("regularite", extraData.regularity, true);
        }
    },

    renderQuests(containerId, questsArray, isDaily) {
        let el = document.getElementById(containerId);
        if(!el) return;
        el.innerHTML = '';
        
        if (!questsArray || questsArray.length === 0) {
            el.innerHTML = '<span style="color:#7f8c8d; font-size:0.8em;">Génération...</span>';
            return;
        }

        questsArray.forEach((q) => {
            let isDone = q.done ? "gami-quest-done" : "";
            
            el.innerHTML += `
                <div class="gami-quest-card ${isDone}">
                    <div class="gami-quest-info">
                        <div class="gami-quest-title">${q.title} <span style="font-size:0.8em; color:#27ae60;">(+${q.moneyReward} €)</span></div>
                        <div class="gami-quest-desc">${q.desc}</div>
                        <div class="gami-quest-progress">${q.progress} / ${q.target}</div>
                    </div>
                </div>
            `;
        });
    },

    updateUI() {
        let elSeason = document.getElementById('gami-season-name');
        let elDates = document.getElementById('gami-season-dates');

        if(elSeason) elSeason.innerText = this.state.seasonName || "Saison";
        if(elDates) elDates.innerText = this.getSeasonDatesString();

        this.renderQuests('gami-daily-container', this.state.dailyQuests, true);
        this.renderQuests('gami-weekly-container', this.state.weeklyQuests, false);
        this.renderQuests('gami-season-container', this.state.seasonQuests, false);
    },

    showToast(msg) {
        let toast = document.createElement('div');
        toast.className = 'gami-toast';
        toast.innerText = msg;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    }
};

window.gami = gami;
